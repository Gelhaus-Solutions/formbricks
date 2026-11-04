import { chmod, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { StorageErrorCode } from "../types/error";

vi.mock("@formbricks/logger", () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

type TLocalService = typeof import("./service");

let root: string;
let local: TLocalService;
const originalEnv = process.env;

const loadService = async (env: Record<string, string | undefined>): Promise<TLocalService> => {
  vi.resetModules();
  process.env = { ...originalEnv, ...env };
  return import("./service");
};

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "gforms-local-storage-"));
  local = await loadService({ UPLOADS_DIR: root, ENCRYPTION_KEY: "k".repeat(64) });
});

afterEach(async () => {
  process.env = originalEnv;
  vi.useRealTimers();
  await chmod(root, 0o700).catch(() => undefined);
  await rm(root, { recursive: true, force: true });
});

/** The browser's request: the presigned fields, then the file, encoded by the platform's FormData. */
const postForm = async (
  fields: Record<string, string>,
  file: Blob | Buffer,
  { contentLength }: { contentLength?: number } = {}
) => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  form.append("file", file instanceof Blob ? file : new Blob([new Uint8Array(file)]));
  const response = new Response(form);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return local.receiveLocalUpload({
    body: Readable.from([bytes]),
    contentType: response.headers.get("content-type"),
    contentLength: contentLength ?? bytes.length,
  });
};

const readStream = async (body: ReadableStream<Uint8Array>): Promise<Buffer> =>
  Buffer.from(await new Response(body).arrayBuffer());

const signUpload = async (maxSize = 1024) => {
  const signed = await local.getSignedUploadUrl("photo--fid--1.png", "image/png", "ws1/public", maxSize);
  if (!signed.ok) throw new Error("signing failed");
  return signed.data;
};

const tempFiles = async (): Promise<string[]> => readdir(path.join(root, ".tmp")).catch(() => []);

describe("signed uploads", () => {
  test("a signed upload is stored at its key and read back with its content type", async () => {
    const { signedUrl, presignedFields } = await signUpload();
    expect(signedUrl).toBe(local.LOCAL_UPLOAD_PATH);

    const stored = await postForm(presignedFields, Buffer.from("png-bytes"));
    expect(stored).toEqual({ ok: true, data: { key: "ws1/public/photo--fid--1.png" } });
    expect(await readFile(path.join(root, "ws1/public/photo--fid--1.png"), "utf8")).toBe("png-bytes");

    const file = await local.getFileStream("ws1/public/photo--fid--1.png");
    if (!file.ok) throw new Error("not found");
    expect(file.data.contentType).toBe("image/png");
    expect(file.data.contentLength).toBe(9);
    expect((await readStream(file.data.body)).toString()).toBe("png-bytes");
  });

  test("a file over the signed size is refused and leaves nothing behind", async () => {
    const { presignedFields } = await signUpload(8);
    expect(await postForm(presignedFields, Buffer.from("123456789"))).toEqual({
      ok: false,
      error: { kind: "too_large" },
    });
    expect(await tempFiles()).toEqual([]);
    expect((await local.getFileStream("ws1/public/photo--fid--1.png")).ok).toBe(false);

    expect((await postForm(presignedFields, Buffer.from("12345678"))).ok).toBe(true);
  });

  test("a declared length over the body cap is refused before the body is read", async () => {
    const { LOCAL_UPLOAD_MAX_BODY_BYTES } = await import("./limits");
    const { presignedFields } = await signUpload();
    expect(
      await postForm(presignedFields, Buffer.from("x"), { contentLength: LOCAL_UPLOAD_MAX_BODY_BYTES + 1 })
    ).toEqual({ ok: false, error: { kind: "too_large" } });
  });

  test("a policy that was altered, or fields that differ from it, are refused", async () => {
    const { presignedFields } = await signUpload(8);
    const policy = JSON.parse(Buffer.from(presignedFields.policy, "base64url").toString()) as object;
    const widened = Buffer.from(JSON.stringify({ ...policy, maxSize: 1_000_000 })).toString("base64url");

    for (const fields of [
      { ...presignedFields, policy: widened },
      { ...presignedFields, key: "ws2/public/photo--fid--1.png" },
      { ...presignedFields, "Content-Type": "text/html" },
      { ...presignedFields, signature: "" },
    ]) {
      expect(await postForm(fields, Buffer.from("x"))).toEqual({ ok: false, error: { kind: "forbidden" } });
    }
    expect((await local.getFileStream("ws2/public/photo--fid--1.png")).ok).toBe(false);
  });

  test("an expired policy is refused", async () => {
    const { presignedFields } = await signUpload();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 3 * 60 * 1000);
    expect(await postForm(presignedFields, Buffer.from("x"))).toEqual({
      ok: false,
      error: { kind: "forbidden" },
    });
  });

  test("a policy signed under another key is refused", async () => {
    const { presignedFields } = await signUpload();
    local = await loadService({ UPLOADS_DIR: root, ENCRYPTION_KEY: "other".repeat(10) });
    expect(await postForm(presignedFields, Buffer.from("x"))).toEqual({
      ok: false,
      error: { kind: "forbidden" },
    });
  });

  test("a field the policy does not sign is refused", async () => {
    const { presignedFields } = await signUpload();
    expect(await postForm({ ...presignedFields, acl: "public-read" }, Buffer.from("x"))).toEqual({
      ok: false,
      error: { kind: "malformed" },
    });
  });

  test("a download link cannot stand in for an upload policy", async () => {
    await writeObject("ws1/public/photo--fid--1.png", "x");
    const link = await local.getSignedDownloadUrl("ws1/public/photo--fid--1.png");
    if (!link.ok) throw new Error("signing failed");
    const query = new URL(link.data, "http://localhost").searchParams;
    const { presignedFields } = await signUpload();
    expect(
      await postForm(
        { ...presignedFields, policy: query.get("token") ?? "", signature: query.get("signature") ?? "" },
        Buffer.from("x")
      )
    ).toEqual({ ok: false, error: { kind: "forbidden" } });
  });

  test("an upload to a key outside the root is never signed", async () => {
    for (const filePath of ["../escape", "ws1/../../escape", ".meta/ws1", "ws1//public", "ws1\\public"]) {
      expect(await local.getSignedUploadUrl("a.png", "image/png", filePath)).toEqual({
        ok: false,
        error: { code: StorageErrorCode.InvalidInput },
      });
    }
  });
});

const writeObject = async (key: string, content: string, contentType = "text/plain") => {
  const result = await local.uploadFileStream(key, Readable.from([Buffer.from(content)]), { contentType });
  if (!result.ok) throw new Error("write failed");
};

describe("server-side streams", () => {
  test("a stream is written at its key with its content type", async () => {
    await writeObject("ws1/private/exports/a.zip", "zip", "application/zip");
    const file = await local.getFileStream("ws1/private/exports/a.zip");
    if (!file.ok) throw new Error("not found");
    expect(file.data.contentType).toBe("application/zip");
    expect((await readStream(file.data.body)).toString()).toBe("zip");
  });

  test("an aborted stream leaves no object behind", async () => {
    const controller = new AbortController();
    const body = new Readable({ read() {} });
    const pending = local.uploadFileStream("ws1/private/exports/b.zip", body, {
      contentType: "application/zip",
      signal: controller.signal,
    });
    body.push(Buffer.from("partial"));
    controller.abort();
    expect(await pending).toEqual({ ok: false, error: { code: StorageErrorCode.Unknown } });
    expect((await local.getFileStream("ws1/private/exports/b.zip")).ok).toBe(false);
    expect(await tempFiles()).toEqual([]);
  });

  test("a missing key reads as not found and a traversal key as invalid", async () => {
    expect(await local.getFileStream("ws1/public/missing.png")).toEqual({
      ok: false,
      error: { code: StorageErrorCode.FileNotFoundError },
    });
    expect(await local.getFileStream("../outside.txt")).toEqual({
      ok: false,
      error: { code: StorageErrorCode.InvalidInput },
    });
    expect(await local.getFileStream("ws1/public")).toEqual({
      ok: false,
      error: { code: StorageErrorCode.FileNotFoundError },
    });
  });
});

describe("signed downloads", () => {
  test("a signed link opens the file with the signed disposition", async () => {
    await writeObject("ws1/private/exports/a.zip", "zip", "application/zip");
    const link = await local.getSignedDownloadUrl("ws1/private/exports/a.zip", {
      responseContentDisposition: 'attachment; filename="a.zip"',
    });
    if (!link.ok) throw new Error("signing failed");
    expect(link.data.startsWith(`${local.LOCAL_DOWNLOAD_PATH}?`)).toBe(true);

    const query = new URL(link.data, "http://localhost").searchParams;
    const opened = await local.openLocalDownload(query.get("token"), query.get("signature"));
    if (!opened.ok) throw new Error("refused");
    expect(opened.data.contentDisposition).toBe('attachment; filename="a.zip"');
    expect(opened.data.contentType).toBe("application/zip");
    expect((await readStream(opened.data.body)).toString()).toBe("zip");
  });

  test("a range request gets that slice of the file, and one past its end is unsatisfiable", async () => {
    await writeObject("ws1/private/exports/r.zip", "0123456789");
    const link = await local.getSignedDownloadUrl("ws1/private/exports/r.zip");
    if (!link.ok) throw new Error("signing failed");
    const query = new URL(link.data, "http://localhost").searchParams;

    const ranged = await local.openLocalDownload(query.get("token"), query.get("signature"), "bytes=4-");
    if (!ranged.ok) throw new Error("refused");
    expect(ranged.data).toMatchObject({ range: { start: 4, end: 9 }, size: 10, contentLength: 6 });
    expect((await readStream(ranged.data.body)).toString()).toBe("456789");

    expect(await local.openLocalDownload(query.get("token"), query.get("signature"), "bytes=10-")).toEqual({
      ok: false,
      error: { kind: "range_not_satisfiable", size: 10 },
    });
  });

  test("a missing file gets no link", async () => {
    expect(await local.getSignedDownloadUrl("ws1/private/missing.zip")).toEqual({
      ok: false,
      error: { code: StorageErrorCode.FileNotFoundError },
    });
  });

  test("an altered, expired or upload-signed token is refused", async () => {
    await writeObject("ws1/private/a.zip", "zip");
    await writeObject("ws2/private/b.zip", "other tenant");
    const link = await local.getSignedDownloadUrl("ws1/private/a.zip", { expiresIn: 60 });
    if (!link.ok) throw new Error("signing failed");
    const query = new URL(link.data, "http://localhost").searchParams;
    const token = JSON.parse(Buffer.from(query.get("token") ?? "", "base64url").toString()) as object;
    const retargeted = Buffer.from(JSON.stringify({ ...token, key: "ws2/private/b.zip" })).toString(
      "base64url"
    );

    expect(await local.openLocalDownload(retargeted, query.get("signature"))).toEqual({
      ok: false,
      error: { kind: "forbidden" },
    });

    const { presignedFields } = await signUpload();
    expect(await local.openLocalDownload(presignedFields.policy, presignedFields.signature)).toEqual({
      ok: false,
      error: { kind: "forbidden" },
    });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 61 * 1000);
    expect(await local.openLocalDownload(query.get("token"), query.get("signature"))).toEqual({
      ok: false,
      error: { kind: "forbidden" },
    });
  });
});

describe("deletes", () => {
  const exists = async (key: string): Promise<boolean> => (await local.getFileStream(key)).ok;

  test("deleting a file removes it and its metadata, and a missing file deletes fine", async () => {
    await writeObject("ws1/public/a.png", "a");
    expect(await local.deleteFile("ws1/public/a.png")).toEqual({ ok: true, data: undefined });
    expect(await exists("ws1/public/a.png")).toBe(false);
    await expect(readdir(path.join(root, ".meta", "ws1", "public"))).resolves.toEqual([]);
    expect(await local.deleteFile("ws1/public/a.png")).toEqual({ ok: true, data: undefined });
    expect((await local.deleteFile("ws1/../ws2/public/b.png")).ok).toBe(false);
  });

  test("a prefix deletes exactly the keys that start with it, as on S3", async () => {
    for (const key of [
      "ws1/private/surveys/s1/elements/e/a.pdf",
      "ws1/private/surveys/s10/elements/e/b.pdf",
      "ws1/public/logo.png",
      "ws10/public/logo.png",
      "ws2/public/logo.png",
    ]) {
      await writeObject(key, key);
    }

    expect((await local.deleteFilesByPrefix("ws1/private/surveys/s1/")).ok).toBe(true);
    expect(await exists("ws1/private/surveys/s1/elements/e/a.pdf")).toBe(false);
    expect(await exists("ws1/private/surveys/s10/elements/e/b.pdf")).toBe(true);

    expect((await local.deleteFilesByPrefix("ws1")).ok).toBe(true);
    expect(await exists("ws1/public/logo.png")).toBe(false);
    expect(await exists("ws10/public/logo.png")).toBe(false);
    expect(await exists("ws2/public/logo.png")).toBe(true);
    await expect(readdir(path.join(root, ".meta"))).resolves.toEqual(["ws2"]);
  });

  test("an empty, root or dot prefix is refused and the backend's own directories survive", async () => {
    await writeObject("ws1/public/a.png", "a");
    await mkdir(path.join(root, ".tmp"), { recursive: true });
    for (const prefix of ["", "  ", "/", ".", ".meta", "../ws1", "ws1/../.."]) {
      expect(await local.deleteFilesByPrefix(prefix)).toEqual({
        ok: false,
        error: { code: StorageErrorCode.InvalidInput },
      });
    }
    expect((await readdir(root)).sort()).toEqual([".meta", ".tmp", "ws1"]);
  });
});

describe("availability", () => {
  test("an uploads directory that cannot be written leaves uploads off", async () => {
    const readOnly = path.join(root, "read-only");
    await mkdir(readOnly);
    await chmod(readOnly, 0o500);
    local = await loadService({
      UPLOADS_DIR: path.join(readOnly, "uploads"),
      ENCRYPTION_KEY: "k".repeat(64),
    });

    expect(local.isLocalStorageAvailable()).toBe(false);
    expect(await local.getSignedUploadUrl("a.png", "image/png", "ws1/public")).toEqual({
      ok: false,
      error: { code: StorageErrorCode.S3CredentialsError },
    });
    await chmod(readOnly, 0o700);
  });

  test("without ENCRYPTION_KEY nothing can be signed, so uploads are off", async () => {
    local = await loadService({ UPLOADS_DIR: root, ENCRYPTION_KEY: undefined });
    expect(local.isLocalStorageAvailable()).toBe(false);
  });
});

describe("parseByteRange", () => {
  test("reads one range, open-ended or as a suffix, clamped to the file", () => {
    expect(local.parseByteRange("bytes=0-4", 10)).toEqual({ start: 0, end: 4 });
    expect(local.parseByteRange("bytes=5-", 10)).toEqual({ start: 5, end: 9 });
    expect(local.parseByteRange("bytes=-3", 10)).toEqual({ start: 7, end: 9 });
    expect(local.parseByteRange("bytes=8-100", 10)).toEqual({ start: 8, end: 9 });
  });

  test("serves the whole file for no range, several ranges or a syntax it does not read", () => {
    for (const header of [null, "", "bytes=0-1,4-5", "items=0-1", "bytes=-", "bytes=5-2"]) {
      expect(local.parseByteRange(header, 10)).toBeNull();
    }
  });

  test("a range that starts past the end is unsatisfiable", () => {
    expect(local.parseByteRange("bytes=10-", 10)).toBe("unsatisfiable");
    expect(local.parseByteRange("bytes=-0", 10)).toBe("unsatisfiable");
    expect(local.parseByteRange("bytes=0-", 0)).toBe("unsatisfiable");
  });
});
