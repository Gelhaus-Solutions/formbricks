import { accessSync, constants as fsConstants, mkdirSync } from "node:fs";
import {
  type FileHandle,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { logger } from "@formbricks/logger";
import { toLoggableErrorCode } from "../loggable-error";
import type { FileStreamResult, SignedDownloadUrlOptions, UploadFileStreamOptions } from "../service";
import { type Result, type StorageError, StorageErrorCode, err, ok } from "../types/error";
import {
  LOCAL_UPLOAD_MAX_BODY_BYTES,
  LOCAL_UPLOAD_MAX_FILE_BYTES,
  LOCAL_UPLOAD_URL_TTL_SECONDS,
} from "./limits";
import { MultipartError, getMultipartBoundary, readMultipartUpload } from "./multipart";
import {
  getMetaPath,
  getMetaRoot,
  getObjectPath,
  getTempDir,
  getTempPath,
  getUploadsRoot,
  isValidLocalKey,
} from "./paths";
import { canSignLocalTokens, encodeLocalTokenPayload, signLocalToken, verifyLocalToken } from "./signing";

/**
 * The local-disk storage backend (GFORMS-36), used when no S3 bucket is configured. Objects live under
 * UPLOADS_DIR at their key; it fits one server or several sharing one volume.
 *
 * Browsers keep the S3 protocol: they get a presigned POST whose URL is this app's upload route
 * (`LOCAL_UPLOAD_PATH`), and the route hands the body to `receiveLocalUpload`. A signed download URL
 * points at `LOCAL_DOWNLOAD_PATH`, served through `openLocalDownload`. Both URLs are paths; the app makes
 * them absolute.
 */

export const LOCAL_UPLOAD_PATH = "/storage/upload";
export const LOCAL_DOWNLOAD_PATH = "/storage/download";

/** The form fields a signed upload carries besides the file. Any other field is refused, as S3 does. */
const UPLOAD_FIELDS = new Set(["key", "Content-Type", "success_action_status", "policy", "signature"]);

interface TObjectMeta {
  contentType: string;
  contentDisposition?: string;
}

interface TUploadPolicy {
  v: 1;
  key: string;
  contentType: string;
  maxSize: number;
  expiresAt: number;
}

interface TDownloadToken {
  v: 1;
  key: string;
  expiresAt: number;
  disposition?: string;
}

/** The part of a filesystem error that is safe to log: never its message, which holds the path. */
const toLoggableFsError = (error: unknown): { name?: string; code: string } => ({
  name: error instanceof Error ? error.name : undefined,
  code: toLoggableErrorCode((error as { code?: unknown } | null)?.code),
});

const isNotFound = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
};

let availability: boolean | undefined;

/**
 * Whether the uploads root exists or can be created, and is writable. Checked once per process. A root
 * that is not (a read-only filesystem with no volume mounted) leaves file uploads off, as a missing S3
 * bucket did, instead of offering uploads that then fail.
 */
export const isLocalStorageAvailable = (): boolean => {
  if (availability !== undefined) return availability;
  const root = getUploadsRoot();
  try {
    mkdirSync(root, { recursive: true });
    accessSync(root, fsConstants.W_OK);
    availability = canSignLocalTokens();
    if (!availability) logger.warn("Local file storage is off: ENCRYPTION_KEY is not set");
  } catch (error) {
    availability = false;
    logger.warn(
      { error: toLoggableFsError(error) },
      "Local file storage is off: the uploads directory is not writable. Mount a writable volume at UPLOADS_DIR or configure S3."
    );
  }
  return availability;
};

const unavailable = (): Result<never, StorageError> => err({ code: StorageErrorCode.S3CredentialsError });

const readMeta = async (root: string, key: string): Promise<TObjectMeta | null> => {
  try {
    const parsed = JSON.parse(await readFile(getMetaPath(root, key), "utf8")) as Partial<TObjectMeta>;
    if (typeof parsed.contentType !== "string") return null;
    return {
      contentType: parsed.contentType,
      contentDisposition:
        typeof parsed.contentDisposition === "string" ? parsed.contentDisposition : undefined,
    };
  } catch {
    return null;
  }
};

/** Writes the metadata, then renames the finished temp file over the object, so readers never see half a file. */
const commitObject = async (
  root: string,
  key: string,
  tempPath: string,
  meta: TObjectMeta
): Promise<void> => {
  const metaPath = getMetaPath(root, key);
  const metaTemp = getTempPath(root);
  await writeFile(metaTemp, JSON.stringify(meta), { flag: "wx" });
  await mkdir(path.dirname(metaPath), { recursive: true });
  await rename(metaTemp, metaPath);

  const objectPath = getObjectPath(root, key);
  await mkdir(path.dirname(objectPath), { recursive: true });
  await rename(tempPath, objectPath);
};

type TSignedUpload = { signedUrl: string; presignedFields: Record<string, string> };

const signUpload = (
  fileName: string,
  contentType: string,
  filePath: string,
  maxSize: number
): Result<TSignedUpload, StorageError> => {
  if (!isLocalStorageAvailable()) return unavailable();

  const key = `${filePath}/${fileName}`;
  if (!isValidLocalKey(key)) return err({ code: StorageErrorCode.InvalidInput });

  const policy: TUploadPolicy = {
    v: 1,
    key,
    contentType,
    maxSize: maxSize > 0 ? Math.min(maxSize, LOCAL_UPLOAD_MAX_FILE_BYTES) : LOCAL_UPLOAD_MAX_FILE_BYTES,
    expiresAt: Date.now() + LOCAL_UPLOAD_URL_TTL_SECONDS * 1000,
  };
  const encodedPolicy = encodeLocalTokenPayload(policy);
  const signature = signLocalToken("upload", encodedPolicy);
  if (!signature) return unavailable();

  return ok({
    signedUrl: LOCAL_UPLOAD_PATH,
    presignedFields: {
      key,
      "Content-Type": contentType,
      success_action_status: "201",
      policy: encodedPolicy,
      signature,
    },
  });
};

/** A presigned POST for this app's upload route, with the S3 backend's signature and field names. */
export const getSignedUploadUrl = (
  fileName: string,
  contentType: string,
  filePath: string,
  maxSize: number = 1024 * 1024 * 10
): Promise<Result<TSignedUpload, StorageError>> =>
  Promise.resolve(signUpload(fileName, contentType, filePath, maxSize));

export type TLocalUploadErrorKind = "malformed" | "too_large" | "forbidden" | "unavailable";

export interface TLocalUploadError {
  kind: TLocalUploadErrorKind;
}

class UploadRefusal extends Error {
  readonly kind: TLocalUploadErrorKind;

  constructor(kind: TLocalUploadErrorKind) {
    super(kind);
    this.name = "UploadRefusal";
    this.kind = kind;
  }
}

const isUploadPolicy = (value: unknown): value is TUploadPolicy => {
  const policy = value as Partial<TUploadPolicy> | null;
  return (
    typeof policy === "object" &&
    policy !== null &&
    policy.v === 1 &&
    typeof policy.key === "string" &&
    typeof policy.contentType === "string" &&
    Number.isSafeInteger(policy.maxSize) &&
    (policy.maxSize ?? -1) >= 0 &&
    (policy.maxSize ?? Infinity) <= LOCAL_UPLOAD_MAX_FILE_BYTES &&
    typeof policy.expiresAt === "number"
  );
};

/** The policy the fields carry, when its signature holds, it has not expired and the fields match it. */
const verifyUploadFields = (fields: Map<string, string>): TUploadPolicy => {
  const policy = verifyLocalToken("upload", fields.get("policy"), fields.get("signature"));
  if (!isUploadPolicy(policy) || policy.expiresAt < Date.now() || !isValidLocalKey(policy.key)) {
    throw new UploadRefusal("forbidden");
  }
  if (fields.get("key") !== policy.key || fields.get("Content-Type") !== policy.contentType) {
    throw new UploadRefusal("forbidden");
  }
  return policy;
};

/**
 * Stores the file of a signed upload. The body is the browser's multipart form: the presigned fields,
 * then the file, which is streamed to a temp file and moved into place only when complete and within the
 * policy's size.
 */
export const receiveLocalUpload = async ({
  body,
  contentType,
  contentLength,
}: {
  body: AsyncIterable<Uint8Array> | null;
  contentType: string | null;
  contentLength: number | null;
}): Promise<Result<{ key: string }, TLocalUploadError>> => {
  if (!isLocalStorageAvailable()) return err({ kind: "unavailable" });
  if (contentLength !== null && contentLength > LOCAL_UPLOAD_MAX_BODY_BYTES)
    return err({ kind: "too_large" });

  const boundary = getMultipartBoundary(contentType);
  if (!boundary || !body) return err({ kind: "malformed" });

  const root = getUploadsRoot();
  const fields = new Map<string, string>();
  let policy: TUploadPolicy | undefined;
  let tempPath: string | undefined;
  let handle: FileHandle | undefined;

  try {
    await readMultipartUpload(body, boundary, {
      onField: (name, value) => {
        if (!UPLOAD_FIELDS.has(name) || fields.has(name)) throw new UploadRefusal("malformed");
        fields.set(name, value);
      },
      onFile: async () => {
        policy = verifyUploadFields(fields);
        await mkdir(getTempDir(root), { recursive: true });
        tempPath = getTempPath(root);
        const fileHandle = await open(tempPath, "wx");
        handle = fileHandle;
        return {
          maxBytes: policy.maxSize,
          write: async (chunk) => {
            await fileHandle.write(chunk);
          },
        };
      },
    });

    if (!policy || !tempPath || !handle) throw new UploadRefusal("malformed");
    await handle.close();
    handle = undefined;
    await commitObject(root, policy.key, tempPath, { contentType: policy.contentType });
    return ok({ key: policy.key });
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (tempPath) await rm(tempPath, { force: true }).catch(() => undefined);

    if (error instanceof UploadRefusal) return err({ kind: error.kind });
    if (error instanceof MultipartError) return err({ kind: error.kind });

    logger.error({ error: toLoggableFsError(error) }, "Failed to store a local upload");
    return err({ kind: "unavailable" });
  }
};

export const getSignedDownloadUrl = async (
  fileKey: string,
  { expiresIn = 60 * 30, responseContentDisposition }: SignedDownloadUrlOptions = {}
): Promise<Result<string, StorageError>> => {
  if (!isLocalStorageAvailable()) return unavailable();
  if (!isValidLocalKey(fileKey)) return err({ code: StorageErrorCode.InvalidInput });

  // Checked first, as the S3 backend's HeadObject does, so a missing file is not handed out as a link.
  try {
    if (!(await stat(getObjectPath(getUploadsRoot(), fileKey))).isFile()) {
      return err({ code: StorageErrorCode.FileNotFoundError });
    }
  } catch (error) {
    if (isNotFound(error)) return err({ code: StorageErrorCode.FileNotFoundError });
    logger.error({ error: toLoggableFsError(error) }, "Failed to check a local file");
    return err({ code: StorageErrorCode.Unknown });
  }

  const token: TDownloadToken = {
    v: 1,
    key: fileKey,
    expiresAt: Date.now() + expiresIn * 1000,
    ...(responseContentDisposition ? { disposition: responseContentDisposition } : {}),
  };
  const encodedToken = encodeLocalTokenPayload(token);
  const signature = signLocalToken("download", encodedToken);
  if (!signature) return unavailable();

  const query = new URLSearchParams({ token: encodedToken, signature });
  return ok(`${LOCAL_DOWNLOAD_PATH}?${query.toString()}`);
};

const isDownloadToken = (value: unknown): value is TDownloadToken => {
  const token = value as Partial<TDownloadToken> | null;
  return (
    typeof token === "object" &&
    token !== null &&
    token.v === 1 &&
    typeof token.key === "string" &&
    typeof token.expiresAt === "number" &&
    (token.disposition === undefined || typeof token.disposition === "string")
  );
};

export type TLocalDownloadErrorKind = "forbidden" | "not_found" | "range_not_satisfiable" | "unavailable";

/** An inclusive byte range of a file. */
export interface TByteRange {
  start: number;
  end: number;
}

/**
 * The single range a `Range` header asks for (RFC 9110 14.2). Null serves the whole file: no header, a
 * syntax this does not read, or several ranges, which a server may answer in full. Browsers resuming a
 * download send one `bytes=<start>-`.
 */
export const parseByteRange = (
  header: string | null | undefined,
  size: number
): TByteRange | null | "unsatisfiable" => {
  const match = header ? /^bytes=(\d{0,15})-(\d{0,15})$/.exec(header.trim()) : null;
  if (!match || (match[1] === "" && match[2] === "")) return null;

  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (suffix === 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(match[1]);
  if (match[2] !== "" && Number(match[2]) < start) return null;
  if (start >= size) return "unsatisfiable";
  return { start, end: match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1) };
};

type TOpenedObject = FileStreamResult & { size: number; range?: TByteRange };

/** Opens an object, or the part of it `rangeHeader` names. The range is resolved against the open file. */
const openObject = async (
  fileKey: string,
  rangeHeader?: string | null
): Promise<Result<TOpenedObject, StorageError | { code: "range_not_satisfiable"; size: number }>> => {
  const root = getUploadsRoot();
  let handle: FileHandle | undefined;
  try {
    handle = await open(getObjectPath(root, fileKey), "r");
    const stats = await handle.stat();
    if (!stats.isFile()) {
      await handle.close();
      return err({ code: StorageErrorCode.FileNotFoundError });
    }

    const range = parseByteRange(rangeHeader, stats.size);
    if (range === "unsatisfiable") {
      await handle.close();
      return err({ code: "range_not_satisfiable", size: stats.size });
    }

    const meta = await readMeta(root, fileKey);
    const stream = handle.createReadStream(range ? { start: range.start, end: range.end } : {});
    return ok({
      body: Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>,
      contentType: meta?.contentType ?? "application/octet-stream",
      contentLength: range ? range.end - range.start + 1 : stats.size,
      size: stats.size,
      ...(range ? { range } : {}),
    });
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (isNotFound(error)) return err({ code: StorageErrorCode.FileNotFoundError });
    logger.error({ error: toLoggableFsError(error) }, "Failed to read a local file");
    return err({ code: StorageErrorCode.Unknown });
  }
};

/**
 * The file a signed download URL names, when its signature holds and it has not expired, or the part of
 * it a `Range` header asks for, so a browser can resume a multi-gigabyte export.
 */
export const openLocalDownload = async (
  encodedToken: string | null,
  signature: string | null,
  rangeHeader?: string | null
): Promise<
  Result<
    FileStreamResult & { size: number; range?: TByteRange; contentDisposition?: string },
    { kind: TLocalDownloadErrorKind; size?: number }
  >
> => {
  if (!isLocalStorageAvailable()) return err({ kind: "unavailable" });

  const token = verifyLocalToken("download", encodedToken, signature);
  if (!isDownloadToken(token) || token.expiresAt < Date.now() || !isValidLocalKey(token.key)) {
    return err({ kind: "forbidden" });
  }

  const file = await openObject(token.key, rangeHeader);
  if (!file.ok) {
    if (file.error.code === "range_not_satisfiable") {
      return err({ kind: "range_not_satisfiable", size: file.error.size });
    }
    return err({
      kind: file.error.code === StorageErrorCode.FileNotFoundError ? "not_found" : "unavailable",
    });
  }

  const meta = await readMeta(getUploadsRoot(), token.key);
  return ok({ ...file.data, contentDisposition: token.disposition ?? meta?.contentDisposition });
};

export const getFileStream = async (fileKey: string): Promise<Result<FileStreamResult, StorageError>> => {
  if (!isLocalStorageAvailable()) return unavailable();
  if (!isValidLocalKey(fileKey)) return err({ code: StorageErrorCode.InvalidInput });

  const file = await openObject(fileKey);
  if (!file.ok)
    return err({
      code: file.error.code === "range_not_satisfiable" ? StorageErrorCode.Unknown : file.error.code,
    });
  const { body, contentType, contentLength } = file.data;
  return ok({ body, contentType, contentLength });
};

export const uploadFileStream = async (
  fileKey: string,
  body: Readable,
  { contentType, contentDisposition, signal }: UploadFileStreamOptions
): Promise<Result<void, StorageError>> => {
  if (!isLocalStorageAvailable()) {
    body.destroy();
    return unavailable();
  }
  if (!isValidLocalKey(fileKey)) {
    body.destroy();
    return err({ code: StorageErrorCode.InvalidInput });
  }
  if (signal?.aborted) {
    body.destroy();
    return err({ code: StorageErrorCode.Unknown });
  }

  const root = getUploadsRoot();
  const tempPath = getTempPath(root);
  try {
    await mkdir(getTempDir(root), { recursive: true });
    const handle = await open(tempPath, "wx");
    await pipeline(body, handle.createWriteStream(), { signal });
    await commitObject(root, fileKey, tempPath, { contentType, contentDisposition });
    return ok(undefined);
  } catch (error) {
    body.destroy();
    await rm(tempPath, { force: true }).catch(() => undefined);
    if (signal?.aborted) {
      logger.warn("Upload aborted");
    } else {
      logger.error({ error: toLoggableFsError(error) }, "Failed to write a local file stream");
    }
    return err({ code: StorageErrorCode.Unknown });
  }
};

export const deleteFile = async (fileKey: string): Promise<Result<void, StorageError>> => {
  if (!isLocalStorageAvailable()) return unavailable();
  if (!isValidLocalKey(fileKey)) return err({ code: StorageErrorCode.InvalidInput });

  const root = getUploadsRoot();
  try {
    // Deleting a key that does not exist succeeds, as S3's DeleteObject does.
    await rm(getObjectPath(root, fileKey), { force: true });
    await rm(getMetaPath(root, fileKey), { force: true });
    return ok(undefined);
  } catch (error) {
    logger.error({ error: toLoggableFsError(error) }, "Failed to delete a local file");
    return err({ code: StorageErrorCode.Unknown });
  }
};

/**
 * Removes every entry of `dir` whose name starts with `namePrefix`. At the root, the backend's own
 * dot-directories are skipped. A metadata file is matched by the object name it belongs to.
 */
const removeMatching = async (
  dir: string,
  namePrefix: string,
  { atRoot, metaTree }: { atRoot: boolean; metaTree: boolean }
): Promise<void> => {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isNotFound(error)) return;
    throw error;
  }

  for (const entry of entries) {
    if (atRoot && entry.name.startsWith(".")) continue;
    const objectName =
      metaTree && entry.isFile() && entry.name.endsWith(".json") ? entry.name.slice(0, -5) : entry.name;
    if (!objectName.startsWith(namePrefix)) continue;
    await rm(path.join(dir, entry.name), { recursive: true, force: true });
  }
};

/** Deletes every object whose key starts with `prefix`, with the same prefix semantics as S3. */
export const deleteFilesByPrefix = async (prefix: string): Promise<Result<void, StorageError>> => {
  if (!isLocalStorageAvailable()) return unavailable();

  const normalizedPrefix = prefix.trim();
  if (!normalizedPrefix || normalizedPrefix === "/") {
    logger.error("Refusing to delete files with an empty or root prefix");
    return err({ code: StorageErrorCode.InvalidInput });
  }

  const lastSlash = normalizedPrefix.lastIndexOf("/");
  const dirKey = lastSlash === -1 ? "" : normalizedPrefix.slice(0, lastSlash);
  const namePrefix = normalizedPrefix.slice(lastSlash + 1);
  // The name part only ever matches entries of one directory, so it needs no more than this; at the root
  // it must not reach the backend's own dot-directories.
  const invalidNamePrefix =
    namePrefix.includes("\\") || namePrefix.includes("\0") || (dirKey === "" && namePrefix.startsWith("."));
  if ((dirKey !== "" && !isValidLocalKey(dirKey)) || invalidNamePrefix) {
    return err({ code: StorageErrorCode.InvalidInput });
  }

  const root = getUploadsRoot();
  const dirSegments = dirKey === "" ? [] : dirKey.split("/");
  try {
    await removeMatching(path.join(root, ...dirSegments), namePrefix, {
      atRoot: dirKey === "",
      metaTree: false,
    });
    await removeMatching(path.join(getMetaRoot(root), ...dirSegments), namePrefix, {
      atRoot: false,
      metaTree: true,
    });
    return ok(undefined);
  } catch (error) {
    logger.error({ error: toLoggableFsError(error) }, "Failed to delete local files by prefix");
    return err({ code: StorageErrorCode.Unknown });
  }
};

/** For tests: forget the cached availability check. */
export const resetLocalStorageAvailabilityForTests = (): void => {
  availability = undefined;
};
