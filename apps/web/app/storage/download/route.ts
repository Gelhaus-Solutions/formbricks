import { type NextRequest } from "next/server";
import { getStorageBackend, openLocalDownload } from "@formbricks/storage";

/**
 * The signed download link of the local-disk storage backend (GFORMS-36), standing in for an S3
 * presigned GET. Only the attachment export route mints these links, after its own access check and
 * audit; the signature and expiry in the query are the authorization here, as on S3.
 */

const STATUS = { forbidden: 403, not_found: 404, range_not_satisfiable: 416, unavailable: 503 } as const;

export const GET = async (request: NextRequest): Promise<Response> => {
  if (getStorageBackend() !== "local") return new Response(null, { status: 404 });

  const query = request.nextUrl.searchParams;
  const result = await openLocalDownload(
    query.get("token"),
    query.get("signature"),
    request.headers.get("range")
  );
  if (!result.ok) {
    const { kind, size } = result.error;
    return new Response(null, {
      status: STATUS[kind],
      headers: {
        "Cache-Control": "no-store",
        ...(kind === "range_not_satisfiable" && size !== undefined && { "Content-Range": `bytes */${size}` }),
      },
    });
  }

  // A browser resumes an interrupted export with a range request against the same link.
  const { body, contentType, contentLength, contentDisposition, range, size } = result.data;
  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(contentLength),
      "Accept-Ranges": "bytes",
      ...(range && { "Content-Range": `bytes ${range.start}-${range.end}/${size}` }),
      ...(contentDisposition && { "Content-Disposition": contentDisposition }),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
