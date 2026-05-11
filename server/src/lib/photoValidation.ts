export const MAX_PHOTO_UPLOAD_BYTES = 8 * 1024 * 1024;

export const SUPPORTED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/avif"
] as const;

export const PHOTO_UPLOAD_TYPE_ERROR = "Photo must be a JPEG, PNG, WebP, GIF, HEIC, HEIF, or AVIF image.";
export const PHOTO_UPLOAD_SIZE_ERROR = "Photo must be 8 MB or smaller.";

type SupportedPhotoMimeType = (typeof SUPPORTED_PHOTO_MIME_TYPES)[number];

const supportedPhotoMimeTypeSet = new Set<string>(SUPPORTED_PHOTO_MIME_TYPES);
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const heifBrands = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);
const avifBrands = new Set(["avif", "avis"]);

export function isSupportedPhotoMimeType(mimeType: string): boolean {
  return supportedPhotoMimeTypeSet.has(mimeType.toLowerCase());
}

export function detectSupportedPhotoMimeType(buffer: Uint8Array): SupportedPhotoMimeType | null {
  if (matchesBytes(buffer, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (matchesBytes(buffer, pngSignature)) {
    return "image/png";
  }

  const firstSixBytes = readAscii(buffer, 0, 6);
  if (firstSixBytes === "GIF87a" || firstSixBytes === "GIF89a") {
    return "image/gif";
  }

  if (readAscii(buffer, 0, 4) === "RIFF" && readAscii(buffer, 8, 4) === "WEBP") {
    return "image/webp";
  }

  if (readAscii(buffer, 4, 4) === "ftyp") {
    const brands = readIsoBmffBrands(buffer);
    if (brands.some((brand) => avifBrands.has(brand))) {
      return "image/avif";
    }
    if (brands.some((brand) => heifBrands.has(brand))) {
      return "image/heic";
    }
  }

  return null;
}

function matchesBytes(buffer: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => buffer[index] === byte);
}

function readAscii(buffer: Uint8Array, offset: number, length: number): string {
  if (buffer.byteLength < offset + length) {
    return "";
  }

  return String.fromCharCode(...buffer.subarray(offset, offset + length));
}

function readIsoBmffBrands(buffer: Uint8Array): readonly string[] {
  const brands: string[] = [];
  for (let offset = 8; offset + 4 <= buffer.byteLength; offset += 4) {
    const brand = readAscii(buffer, offset, 4);
    if (brand) {
      brands.push(brand);
    }
  }
  return brands;
}
