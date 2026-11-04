import { randomUUID } from "node:crypto";
import path from "node:path";
import { UPLOADS_DIR } from "../constants";
import { LOCAL_KEY_MAX_BYTES, LOCAL_KEY_SEGMENT_MAX_BYTES } from "./limits";

/** Holds each object's content type and disposition, mirrored on the object's key. */
const META_DIR = ".meta";

/** Files being written. Same filesystem as the objects, so a finished file is renamed into place. */
const TMP_DIR = ".tmp";

/**
 * The backend's root directory. The Docker image sets UPLOADS_DIR to its `/home/nextjs/apps/web/uploads`
 * volume; without it the default is `./uploads` from the working directory, `apps/web/uploads` under
 * `next dev`.
 */
export const getUploadsRoot = (): string => path.resolve(UPLOADS_DIR?.trim() || "uploads");

const isSafeSegment = (segment: string): boolean =>
  segment !== "" &&
  segment !== "." &&
  segment !== ".." &&
  !segment.includes("\\") &&
  !segment.includes("\0") &&
  Buffer.byteLength(segment) <= LOCAL_KEY_SEGMENT_MAX_BYTES;

/**
 * Whether a key can name an object on disk. A key is `/`-separated, like an S3 key, but every segment must
 * be a plain name: no `.` or `..`, no empty segment, no `\` or NUL, so no key reaches outside the root. A
 * first segment starting with `.` is refused too, because the backend keeps its own directories there.
 */
export const isValidLocalKey = (key: string): boolean => {
  if (!key || Buffer.byteLength(key) > LOCAL_KEY_MAX_BYTES) return false;
  const segments = key.split("/");
  if (segments[0].startsWith(".")) return false;
  return segments.every(isSafeSegment);
};

const insideRoot = (root: string, target: string): string => {
  // Defence in depth: isValidLocalKey already rules out every segment that could leave the root.
  if (!target.startsWith(root + path.sep)) {
    throw new Error("Resolved storage path is outside the uploads root");
  }
  return target;
};

/** The object's file. Only for a key `isValidLocalKey` accepted. */
export const getObjectPath = (root: string, key: string): string =>
  insideRoot(root, path.join(root, ...key.split("/")));

/** The object's metadata file. Only for a key `isValidLocalKey` accepted. */
export const getMetaPath = (root: string, key: string): string =>
  insideRoot(root, `${path.join(root, META_DIR, ...key.split("/"))}.json`);

/** The tree that mirrors the object keys with their metadata files. */
export const getMetaRoot = (root: string): string => path.join(root, META_DIR);

/** A fresh temporary file name, inside the root's own temp directory. */
export const getTempPath = (root: string): string => path.join(root, TMP_DIR, randomUUID());

export const getTempDir = (root: string): string => path.join(root, TMP_DIR);
