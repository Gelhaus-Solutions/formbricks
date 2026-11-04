import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { OPTIONS, POST } from "./route";

const mocks = vi.hoisted(() => ({ backend: "local", receive: vi.fn() }));

vi.mock("@formbricks/storage", () => ({
  getStorageBackend: () => mocks.backend,
  receiveLocalUpload: mocks.receive,
}));

const post = () =>
  POST(
    new NextRequest("http://localhost/storage/upload", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=abc", "content-length": "42" },
      body: "--abc--",
    })
  );

describe("POST /storage/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.backend = "local";
  });

  test("stores the upload and answers 201 to any origin, as S3 does with success_action_status", async () => {
    mocks.receive.mockResolvedValue({ ok: true, data: { key: "ws/public/a.png" } });

    const response = await post();

    expect(response.status).toBe(201);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(mocks.receive).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "multipart/form-data; boundary=abc", contentLength: 42 })
    );
  });

  test.each([
    ["too_large", 413, "EntityTooLarge"],
    ["forbidden", 403, "AccessDenied"],
    ["malformed", 400, "MalformedPOSTRequest"],
    ["unavailable", 503, "ServiceUnavailable"],
  ])("answers a %s upload with %i and S3's %s code", async (kind, status, code) => {
    mocks.receive.mockResolvedValue({ ok: false, error: { kind } });

    const response = await post();

    expect(response.status).toBe(status);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    // The survey bundle shows its "file too large" message when the body names EntityTooLarge.
    expect(await response.text()).toContain(`<Code>${code}</Code>`);
  });

  test("does not exist while S3 is the backend", async () => {
    mocks.backend = "s3";

    expect((await post()).status).toBe(404);
    expect(mocks.receive).not.toHaveBeenCalled();
  });

  test("answers the CORS preflight of a survey embedded on another site", async () => {
    const response = await OPTIONS();

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });
});
