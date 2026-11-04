import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ backend: "local", open: vi.fn() }));

vi.mock("@formbricks/storage", () => ({
  getStorageBackend: () => mocks.backend,
  openLocalDownload: mocks.open,
}));

const get = (headers: Record<string, string> = {}) =>
  GET(new NextRequest("http://localhost/storage/download?token=t&signature=s", { headers }));

const file = (overrides: Record<string, unknown> = {}) => ({
  ok: true,
  data: {
    body: new ReadableStream(),
    contentType: "application/zip",
    contentLength: 10,
    size: 10,
    contentDisposition: 'attachment; filename="a.zip"',
    ...overrides,
  },
});

describe("GET /storage/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.backend = "local";
  });

  test("serves the signed file as an uncached attachment", async () => {
    mocks.open.mockResolvedValue(file());

    const response = await get();

    expect(mocks.open).toHaveBeenCalledWith("t", "s", null);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="a.zip"');
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
  });

  test("answers a resumed download with the requested part", async () => {
    mocks.open.mockResolvedValue(file({ range: { start: 4, end: 9 }, contentLength: 6 }));

    const response = await get({ range: "bytes=4-" });

    expect(mocks.open).toHaveBeenCalledWith("t", "s", "bytes=4-");
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 4-9/10");
    expect(response.headers.get("content-length")).toBe("6");
  });

  test.each([
    ["forbidden", 403],
    ["not_found", 404],
    ["unavailable", 503],
  ])("answers a %s link with %i", async (kind, status) => {
    mocks.open.mockResolvedValue({ ok: false, error: { kind } });

    expect((await get()).status).toBe(status);
  });

  test("answers a range past the end with 416 and the file's size", async () => {
    mocks.open.mockResolvedValue({ ok: false, error: { kind: "range_not_satisfiable", size: 10 } });

    const response = await get({ range: "bytes=10-" });

    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */10");
  });

  test("does not exist while S3 is the backend", async () => {
    mocks.backend = "s3";

    expect((await get()).status).toBe(404);
    expect(mocks.open).not.toHaveBeenCalled();
  });
});
