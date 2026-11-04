import { type NextRequest } from "next/server";
import { Readable } from "node:stream";
import { type TLocalUploadErrorKind, getStorageBackend, receiveLocalUpload } from "@formbricks/storage";

/**
 * The upload endpoint of the local-disk storage backend (GFORMS-36): the URL of the presigned POST a
 * browser gets when no S3 bucket is configured. The signed policy among the form fields is the only
 * authorization, as on S3, so the route reads no session and answers any origin: app surveys upload from
 * the sites they are embedded in. Errors keep S3's XML codes, which the survey bundle already reads.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const ERRORS: Record<TLocalUploadErrorKind, { status: number; code: string; message: string }> = {
  malformed: {
    status: 400,
    code: "MalformedPOSTRequest",
    message: "The body of the POST request is not well-formed.",
  },
  too_large: { status: 413, code: "EntityTooLarge", message: "The upload exceeds the maximum allowed size." },
  forbidden: { status: 403, code: "AccessDenied", message: "The upload policy is invalid or has expired." },
  unavailable: { status: 503, code: "ServiceUnavailable", message: "File storage is not available." },
};

const errorResponse = (kind: TLocalUploadErrorKind): Response => {
  const { status, code, message } = ERRORS[kind];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Error><Code>${code}</Code><Message>${message}</Message></Error>`,
    {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/xml", "Cache-Control": "no-store" },
    }
  );
};

const parseContentLength = (value: string | null): number | null =>
  value !== null && /^\d+$/.test(value) ? Number(value) : null;

export const OPTIONS = async (): Promise<Response> =>
  new Response(null, { status: 204, headers: { ...CORS_HEADERS, "Access-Control-Max-Age": "3600" } });

export const POST = async (request: NextRequest): Promise<Response> => {
  // With S3 configured, browsers post to the bucket; this route does not exist for them.
  if (getStorageBackend() !== "local") {
    return new Response(null, { status: 404, headers: CORS_HEADERS });
  }

  const result = await receiveLocalUpload({
    body: request.body ? Readable.fromWeb(request.body as Parameters<typeof Readable.fromWeb>[0]) : null,
    contentType: request.headers.get("content-type"),
    contentLength: parseContentLength(request.headers.get("content-length")),
  });

  if (!result.ok) return errorResponse(result.error.kind);

  // The policy's success_action_status: 201, as S3 answers it.
  return new Response(null, { status: 201, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } });
};
