import type { Readable } from "node:stream";
import { S3_BUCKET_NAME } from "./constants";
import * as local from "./local/service";
import * as s3 from "./service";

/**
 * Picks the storage backend: S3 when a bucket is configured, the local disk otherwise (GFORMS-36). Every
 * entry point keeps the S3 module's signature, so callers never know which one serves them.
 */
export type TStorageBackend = "s3" | "local";

export const getStorageBackend = (): TStorageBackend => (S3_BUCKET_NAME ? "s3" : "local");

const isLocal = (): boolean => getStorageBackend() === "local";

/** Whether uploads have somewhere to go: a configured bucket, or a writable uploads directory. */
export const isStorageAvailable = (): boolean => !isLocal() || local.isLocalStorageAvailable();

export const getSignedUploadUrl = (
  fileName: string,
  contentType: string,
  filePath: string,
  maxSize?: number
): ReturnType<typeof s3.getSignedUploadUrl> =>
  isLocal()
    ? local.getSignedUploadUrl(fileName, contentType, filePath, maxSize)
    : s3.getSignedUploadUrl(fileName, contentType, filePath, maxSize);

export const getSignedDownloadUrl = (
  fileKey: string,
  options?: s3.SignedDownloadUrlOptions
): ReturnType<typeof s3.getSignedDownloadUrl> =>
  isLocal() ? local.getSignedDownloadUrl(fileKey, options) : s3.getSignedDownloadUrl(fileKey, options);

export const getFileStream = (fileKey: string): ReturnType<typeof s3.getFileStream> =>
  isLocal() ? local.getFileStream(fileKey) : s3.getFileStream(fileKey);

export const uploadFileStream = (
  fileKey: string,
  body: Readable,
  options: s3.UploadFileStreamOptions
): ReturnType<typeof s3.uploadFileStream> =>
  isLocal() ? local.uploadFileStream(fileKey, body, options) : s3.uploadFileStream(fileKey, body, options);

export const deleteFile = (fileKey: string): ReturnType<typeof s3.deleteFile> =>
  isLocal() ? local.deleteFile(fileKey) : s3.deleteFile(fileKey);

export const deleteFilesByPrefix = (prefix: string): ReturnType<typeof s3.deleteFilesByPrefix> =>
  isLocal() ? local.deleteFilesByPrefix(prefix) : s3.deleteFilesByPrefix(prefix);
