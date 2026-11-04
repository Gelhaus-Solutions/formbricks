import {
  LOCAL_UPLOAD_MAX_FIELD_BYTES,
  LOCAL_UPLOAD_MAX_PARTS,
  LOCAL_UPLOAD_MAX_PART_HEADER_BYTES,
  LOCAL_UPLOAD_MAX_PREAMBLE_BYTES,
} from "./limits";

/**
 * A streaming reader for the `multipart/form-data` body of a presigned POST (RFC 7578), so a file of up to
 * a gigabyte goes to disk as it arrives instead of being held in memory.
 *
 * It reads the form the way S3 does: text fields first, then the part named `file`, whose bytes are
 * handed on; parsing stops after the file, since S3 ignores anything that follows it. Every dimension is
 * capped (see ./limits).
 */

export type TMultipartErrorKind = "malformed" | "too_large";

export class MultipartError extends Error {
  readonly kind: TMultipartErrorKind;

  constructor(kind: TMultipartErrorKind) {
    super(kind === "too_large" ? "File exceeds the upload limit" : "Malformed multipart body");
    this.name = "MultipartError";
    this.kind = kind;
  }
}

export interface TMultipartPartHeaders {
  name: string;
  filename?: string;
  contentType?: string;
}

export interface TMultipartFileSink {
  /** The file's byte limit; one byte more is refused as too large. */
  maxBytes: number;
  write: (chunk: Buffer) => Promise<void>;
}

export interface TMultipartHandlers {
  /** Called for each text field, in order. Throw to refuse the form. */
  onField: (name: string, value: string) => void;
  /** Called once, when the file part starts. Throw to refuse the form before any byte is written. */
  onFile: (headers: TMultipartPartHeaders) => Promise<TMultipartFileSink>;
}

const HEADER_END = Buffer.from("\r\n\r\n");

// RFC 2046 boundary characters, without the space (no browser sends one).
const BOUNDARY_PATTERN = /^[0-9A-Za-z'()+_,\-./:=?]{1,70}$/;

/** The boundary of a `multipart/form-data` content type, or null for any other type. */
export const getMultipartBoundary = (contentType: string | null | undefined): string | null => {
  if (!contentType) return null;
  const [mediaType, ...parameters] = contentType.split(";");
  if (mediaType.trim().toLowerCase() !== "multipart/form-data") return null;

  for (const parameter of parameters) {
    const separator = parameter.indexOf("=");
    if (separator === -1) continue;
    if (parameter.slice(0, separator).trim().toLowerCase() !== "boundary") continue;
    let value = parameter.slice(separator + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    return BOUNDARY_PATTERN.test(value) ? value : null;
  }

  return null;
};

class ChunkReader {
  private buffer: Buffer = Buffer.alloc(0);
  private readonly iterator: AsyncIterator<Uint8Array>;

  constructor(source: AsyncIterable<Uint8Array>) {
    this.iterator = source[Symbol.asyncIterator]();
  }

  /** Appends the next chunk. The body ending here is malformed: every caller still expects a delimiter. */
  private async pull(): Promise<void> {
    const next = await this.iterator.next();
    if (next.done) throw new MultipartError("malformed");
    const chunk = Buffer.from(next.value.buffer, next.value.byteOffset, next.value.byteLength);
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
  }

  /** Stops reading the body; the rest of it is never consumed. */
  async close(): Promise<void> {
    await this.iterator.return?.();
  }

  async read(length: number): Promise<Buffer> {
    while (this.buffer.length < length) await this.pull();
    const out = this.buffer.subarray(0, length);
    this.buffer = this.buffer.subarray(length);
    return out;
  }

  /** The bytes before `delimiter`, which is consumed. More than `limit` bytes before it is malformed. */
  async readUntil(delimiter: Buffer, limit: number): Promise<Buffer> {
    for (;;) {
      const index = this.buffer.indexOf(delimiter);
      if (index !== -1) {
        if (index > limit) throw new MultipartError("malformed");
        const out = this.buffer.subarray(0, index);
        this.buffer = this.buffer.subarray(index + delimiter.length);
        return out;
      }
      if (this.buffer.length > limit + delimiter.length) throw new MultipartError("malformed");
      await this.pull();
    }
  }

  /**
   * Streams the bytes before `delimiter` into `sink`, holding back only the tail that could be the start of
   * the delimiter split across two chunks. Returns how many bytes went to the sink.
   */
  async pipeUntil(delimiter: Buffer, sink: TMultipartFileSink): Promise<number> {
    let total = 0;
    for (;;) {
      const index = this.buffer.indexOf(delimiter);
      const end = index === -1 ? this.buffer.length - (delimiter.length - 1) : index;
      if (end > 0) {
        total += end;
        if (total > sink.maxBytes) throw new MultipartError("too_large");
        await sink.write(this.buffer.subarray(0, end));
      }
      if (index !== -1) {
        this.buffer = this.buffer.subarray(index + delimiter.length);
        return total;
      }
      if (end > 0) this.buffer = this.buffer.subarray(end);
      await this.pull();
    }
  }
}

const DISPOSITION_NAME = /(?:^|;)\s*name="([^"]*)"/i;
const DISPOSITION_FILENAME = /(?:^|;)\s*filename="([^"]*)"/i;

const parsePartHeaders = (block: Buffer): TMultipartPartHeaders => {
  let disposition: string | undefined;
  let contentType: string | undefined;

  for (const line of block.toString("utf8").split("\r\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) throw new MultipartError("malformed");
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (name === "content-disposition") disposition = value;
    if (name === "content-type") contentType = value;
  }

  if (!disposition?.toLowerCase().startsWith("form-data")) throw new MultipartError("malformed");
  const name = DISPOSITION_NAME.exec(disposition)?.[1];
  if (!name) throw new MultipartError("malformed");

  return { name, filename: DISPOSITION_FILENAME.exec(disposition)?.[1], contentType };
};

/**
 * Reads the form up to and including its `file` part. Resolves with the file's size once every byte of it
 * went to the sink; rejects with a MultipartError, or with whatever a handler or the sink threw.
 */
export const readMultipartUpload = async (
  source: AsyncIterable<Uint8Array>,
  boundary: string,
  handlers: TMultipartHandlers
): Promise<{ fileBytes: number }> => {
  const reader = new ChunkReader(source);
  const partDelimiter = Buffer.from(`\r\n--${boundary}`);

  try {
    await reader.readUntil(Buffer.from(`--${boundary}`), LOCAL_UPLOAD_MAX_PREAMBLE_BYTES);

    for (let parts = 0; ; parts++) {
      // After a delimiter, CRLF starts the next part and `--` ends the form, here before any file.
      if ((await reader.read(2)).toString("latin1") !== "\r\n") throw new MultipartError("malformed");
      if (parts >= LOCAL_UPLOAD_MAX_PARTS) throw new MultipartError("malformed");

      const headers = parsePartHeaders(
        await reader.readUntil(HEADER_END, LOCAL_UPLOAD_MAX_PART_HEADER_BYTES)
      );

      if (headers.name !== "file") {
        if (headers.filename !== undefined) throw new MultipartError("malformed");
        const value = await reader.readUntil(partDelimiter, LOCAL_UPLOAD_MAX_FIELD_BYTES);
        handlers.onField(headers.name, value.toString("utf8"));
        continue;
      }

      const sink = await handlers.onFile(headers);
      const fileBytes = await reader.pipeUntil(partDelimiter, sink);
      return { fileBytes };
    }
  } finally {
    await reader.close().catch(() => undefined);
  }
};
