// Validation for admin-uploaded product photos.
//
// The declared MIME type and the filename both come from the client and can say
// anything, so neither is trusted: the format is decided by inspecting the
// leading bytes, and the stored filename is generated here.

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export type ImageKind = { ext: "jpg" | "png" | "webp"; mime: string };

/// Magic-number sniffing. A renamed script or PDF fails here even if it claims
/// to be image/jpeg.
export function detectImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, index) => bytes[index] === byte)) {
    return { ext: "png", mime: "image/png" };
  }

  // WebP: "RIFF" .... "WEBP"
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  if (
    riff.every((byte, index) => bytes[index] === byte) &&
    webp.every((byte, index) => bytes[index + 8] === byte)
  ) {
    return { ext: "webp", mime: "image/webp" };
  }

  return null;
}

/**
 * Filenames are generated, never taken from the upload. A client-supplied name
 * could contain path separators or "..", and the SKU code alone would let a
 * replacement be served from cache under the old URL.
 */
export function photoFilename(skuCode: string, ext: string, random: string): string {
  const safeCode = skuCode.replace(/[^A-Za-z0-9-]/g, "").slice(0, 60) || "sku";
  return `${safeCode}-${random}.${ext}`;
}
