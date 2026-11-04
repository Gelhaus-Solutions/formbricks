import { Readable } from "node:stream";
import { beforeEach, describe, expect, test, vi } from "vitest";

const calls = vi.hoisted(() => ({ s3: [] as string[], local: [] as string[] }));

const fakeBackend = (name: "s3" | "local") =>
  Object.fromEntries(
    [
      "getSignedUploadUrl",
      "getSignedDownloadUrl",
      "getFileStream",
      "uploadFileStream",
      "deleteFile",
      "deleteFilesByPrefix",
    ].map((fn) => [
      fn,
      vi.fn(() => {
        calls[name].push(fn);
        return Promise.resolve({ ok: true, data: undefined });
      }),
    ])
  );

vi.mock("./service", () => fakeBackend("s3"));
vi.mock("./local/service", () => ({ ...fakeBackend("local"), isLocalStorageAvailable: () => false }));

const loadBackend = async (bucket: string | undefined) => {
  vi.resetModules();
  vi.doMock("./constants", () => ({ S3_BUCKET_NAME: bucket }));
  return import("./backend");
};

const callAll = async (backend: typeof import("./backend")) => {
  await backend.getSignedUploadUrl("a.png", "image/png", "ws/public", 10);
  await backend.getSignedDownloadUrl("ws/private/a.zip");
  await backend.getFileStream("ws/public/a.png");
  await backend.uploadFileStream("ws/private/a.zip", Readable.from([]), { contentType: "application/zip" });
  await backend.deleteFile("ws/public/a.png");
  await backend.deleteFilesByPrefix("ws/");
};

describe("storage backend selection", () => {
  beforeEach(() => {
    calls.s3.length = 0;
    calls.local.length = 0;
  });

  test("a configured bucket sends every call to S3", async () => {
    const backend = await loadBackend("bucket");
    await callAll(backend);
    expect(backend.getStorageBackend()).toBe("s3");
    expect(backend.isStorageAvailable()).toBe(true);
    expect(calls.s3).toHaveLength(6);
    expect(calls.local).toEqual([]);
  });

  test("without a bucket every call goes to the local disk, which decides availability", async () => {
    const backend = await loadBackend(undefined);
    await callAll(backend);
    expect(backend.getStorageBackend()).toBe("local");
    expect(backend.isStorageAvailable()).toBe(false);
    expect(calls.local).toHaveLength(6);
    expect(calls.s3).toEqual([]);
  });
});
