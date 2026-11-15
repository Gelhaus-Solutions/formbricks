"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@/lib/utils/action-client";

const ZConvertHeicToJpegInput = z.object({
  file: z.instanceof(File),
});

export const convertHeicToJpegAction = authenticatedActionClient
  .inputSchema(ZConvertHeicToJpegInput)
  .action(async ({ parsedInput }) => {
    if (!parsedInput.file || !parsedInput.file.name.endsWith(".heic")) return parsedInput.file;

    const convert = (await import("heic-convert")).default;

    const arrayBuffer = await parsedInput.file.arrayBuffer();

    const convertedBuffer = await convert({
      buffer: Buffer.from(arrayBuffer),
      format: "JPEG",
      quality: 0.9,
    });

    // Copied into a buffer of its own: a File takes only ArrayBuffer-backed views.
    return new File([new Uint8Array(convertedBuffer)], parsedInput.file.name.replace(/\.heic$/, ".jpg"), {
      type: "image/jpeg",
    });
  });
