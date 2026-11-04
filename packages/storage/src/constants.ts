export const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
export const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
export const S3_REGION = process.env.S3_REGION;
export const S3_ENDPOINT_URL = process.env.S3_ENDPOINT_URL;
export const S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE === "1";
export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

/** Root of the local-disk backend, used when no S3 bucket is configured. Relative to the working directory. */
export const UPLOADS_DIR = process.env.UPLOADS_DIR;

/** Signs the local backend's upload policies and download links (through HKDF, never used directly). */
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
