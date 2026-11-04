/**
 * Caps for the local-disk backend (GFORMS-36). Each one bounds input a browser sends to the upload route
 * or a key a caller hands the backend, and each is far above what the app itself produces.
 */

/** How long a signed upload stays valid: the same two minutes the S3 presigned POST gets. */
export const LOCAL_UPLOAD_URL_TTL_SECONDS = 2 * 60;

/** Largest file one upload may carry: the biggest limit any caller asks for (1 GiB). */
export const LOCAL_UPLOAD_MAX_FILE_BYTES = 1024 * 1024 * 1024;

/** Room for the form fields and part headers around the file. */
export const LOCAL_UPLOAD_MAX_FORM_OVERHEAD_BYTES = 64 * 1024;

/** A declared `Content-Length` above this is refused before the body is read. */
export const LOCAL_UPLOAD_MAX_BODY_BYTES = LOCAL_UPLOAD_MAX_FILE_BYTES + LOCAL_UPLOAD_MAX_FORM_OVERHEAD_BYTES;

/** Bytes before the first boundary. Browsers send none. */
export const LOCAL_UPLOAD_MAX_PREAMBLE_BYTES = 1024;

/** One part's header block. */
export const LOCAL_UPLOAD_MAX_PART_HEADER_BYTES = 8 * 1024;

/** One text field's value. The policy, the largest, is a few hundred bytes. */
export const LOCAL_UPLOAD_MAX_FIELD_BYTES = 8 * 1024;

/** Parts in one form: the five signed fields and the file, with room to spare. */
export const LOCAL_UPLOAD_MAX_PARTS = 8;

/** A key's length, the same limit S3 sets. */
export const LOCAL_KEY_MAX_BYTES = 1024;

/** One path segment of a key, the limit common filesystems set on a file name. */
export const LOCAL_KEY_SEGMENT_MAX_BYTES = 255;
