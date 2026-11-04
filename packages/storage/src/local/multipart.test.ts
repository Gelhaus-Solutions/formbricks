import { Readable } from "node:stream";
import { describe, expect, test } from "vitest";
import { LOCAL_UPLOAD_MAX_FIELD_BYTES, LOCAL_UPLOAD_MAX_PARTS } from "./limits";
import {
  MultipartError,
  type TMultipartPartHeaders,
  getMultipartBoundary,
  readMultipartUpload,
} from "./multipart";

/** Encodes a form exactly as a browser's fetch would, through the platform's own FormData encoder. */
const encodeForm = async (
  entries: [string, string | Blob][]
): Promise<{ bytes: Uint8Array; boundary: string; contentType: string }> => {
  const form = new FormData();
  for (const [name, value] of entries) form.append(name, value);
  const response = new Response(form);
  const contentType = response.headers.get("content-type") ?? "";
  const boundary = getMultipartBoundary(contentType);
  if (!boundary) throw new Error("no boundary");
  return { bytes: new Uint8Array(await response.arrayBuffer()), boundary, contentType };
};

/** The body as a stream of `size`-byte chunks, the way a socket delivers it. */
const chunked = (bytes: Uint8Array, size: number): Readable =>
  Readable.from(
    Array.from({ length: Math.ceil(bytes.length / size) }, (_, i) =>
      Buffer.from(bytes.subarray(i * size, (i + 1) * size))
    )
  );

const collect = async (
  bytes: Uint8Array,
  boundary: string,
  { chunkSize = 64 * 1024, maxBytes = 1024 * 1024 }: { chunkSize?: number; maxBytes?: number } = {}
) => {
  const fields: [string, string][] = [];
  const written: Buffer[] = [];
  let fileHeaders: TMultipartPartHeaders | undefined;
  const result = await readMultipartUpload(chunked(bytes, chunkSize), boundary, {
    onField: (name, value) => fields.push([name, value]),
    onFile: (headers) => {
      fileHeaders = headers;
      return Promise.resolve({
        maxBytes,
        write: (chunk) => {
          written.push(Buffer.from(chunk));
          return Promise.resolve();
        },
      });
    },
  });
  return { fields, file: Buffer.concat(written), fileHeaders, fileBytes: result.fileBytes };
};

const rejection = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof MultipartError) return error.kind;
    throw error;
  }
  return "resolved";
};

describe("getMultipartBoundary", () => {
  test("reads the boundary of a form-data type, quoted or not", () => {
    expect(getMultipartBoundary("multipart/form-data; boundary=abc123")).toBe("abc123");
    expect(getMultipartBoundary('Multipart/Form-Data; charset=utf-8; boundary="a-b_c"')).toBe("a-b_c");
  });

  test("refuses other types and boundaries outside RFC 2046", () => {
    expect(getMultipartBoundary("application/json")).toBeNull();
    expect(getMultipartBoundary("multipart/mixed; boundary=abc")).toBeNull();
    expect(getMultipartBoundary("multipart/form-data")).toBeNull();
    expect(getMultipartBoundary(`multipart/form-data; boundary=${"a".repeat(71)}`)).toBeNull();
    expect(getMultipartBoundary("multipart/form-data; boundary=a\r\nb")).toBeNull();
    expect(getMultipartBoundary(null)).toBeNull();
  });
});

describe("readMultipartUpload", () => {
  const fileBytes = Buffer.from(Array.from({ length: 70_000 }, (_, i) => i % 251));

  test("hands over the fields in order and the file byte for byte, whatever the chunk size", async () => {
    const { bytes, boundary } = await encodeForm([
      ["key", "ws/private/file--fid--1.png"],
      ["Content-Type", "image/png"],
      ["file", new Blob([fileBytes], { type: "image/png" })],
    ]);

    for (const chunkSize of [1, 7, 4096, bytes.length]) {
      const result = await collect(bytes, boundary, { chunkSize });
      expect(result.fields).toEqual([
        ["key", "ws/private/file--fid--1.png"],
        ["Content-Type", "image/png"],
      ]);
      expect(result.file.equals(fileBytes)).toBe(true);
      expect(result.fileBytes).toBe(fileBytes.length);
      expect(result.fileHeaders).toMatchObject({ name: "file", filename: "blob", contentType: "image/png" });
    }
  });

  test("keeps a file whose bytes look like the start of a delimiter", async () => {
    const tricky = Buffer.from("\r\n--\r\n-\r\n--x\r\n");
    const { bytes, boundary } = await encodeForm([["file", new Blob([tricky])]]);
    const result = await collect(bytes, boundary, { chunkSize: 3 });
    expect(result.file.equals(tricky)).toBe(true);
  });

  test("accepts a file of exactly the limit and refuses one byte more", async () => {
    const { bytes, boundary } = await encodeForm([["file", new Blob([fileBytes])]]);
    await expect(collect(bytes, boundary, { maxBytes: fileBytes.length })).resolves.toMatchObject({
      fileBytes: fileBytes.length,
    });
    expect(await rejection(collect(bytes, boundary, { maxBytes: fileBytes.length - 1 }))).toBe("too_large");
  });

  test("refuses a body cut off inside the file", async () => {
    const { bytes, boundary } = await encodeForm([["file", new Blob([fileBytes])]]);
    expect(await rejection(collect(bytes.subarray(0, bytes.length - 60), boundary))).toBe("malformed");
  });

  test("refuses a form without a file part", async () => {
    const { bytes, boundary } = await encodeForm([["key", "a"]]);
    expect(await rejection(collect(bytes, boundary))).toBe("malformed");
  });

  test("refuses a text field over its limit", async () => {
    const { bytes, boundary } = await encodeForm([
      ["policy", "p".repeat(LOCAL_UPLOAD_MAX_FIELD_BYTES + 1)],
      ["file", new Blob(["x"])],
    ]);
    expect(await rejection(collect(bytes, boundary))).toBe("malformed");

    const atLimit = await encodeForm([
      ["policy", "p".repeat(LOCAL_UPLOAD_MAX_FIELD_BYTES)],
      ["file", new Blob(["x"])],
    ]);
    await expect(collect(atLimit.bytes, atLimit.boundary)).resolves.toMatchObject({ fileBytes: 1 });
  });

  test("refuses more parts than the limit", async () => {
    const fields: [string, string][] = Array.from({ length: LOCAL_UPLOAD_MAX_PARTS }, (_, i) => [
      `f${i}`,
      "v",
    ]);
    const { bytes, boundary } = await encodeForm([...fields, ["file", new Blob(["x"])]]);
    expect(await rejection(collect(bytes, boundary))).toBe("malformed");
  });

  test("refuses a file sent under another field name", async () => {
    const { bytes, boundary } = await encodeForm([
      ["upload", new Blob(["x"])],
      ["file", new Blob(["y"])],
    ]);
    expect(await rejection(collect(bytes, boundary))).toBe("malformed");
  });

  test("passes a handler's refusal on, before any byte of the file is written", async () => {
    const { bytes, boundary } = await encodeForm([["file", new Blob([fileBytes])]]);
    await expect(
      readMultipartUpload(chunked(bytes, 1024), boundary, {
        onField: () => undefined,
        onFile: () => Promise.reject(new Error("refused")),
      })
    ).rejects.toThrow("refused");
  });
});
