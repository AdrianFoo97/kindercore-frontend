// How-To Guide step photos — what the picker takes, and how big the photo
// is once shrunk on the device before uploading (phone photos are 3–8 MB;
// at 1600 px they're a few hundred KB and still sharp on a printed poster).

const MB = 1024 * 1024;
/** Longest side after shrinking, in px. */
export const MAX_PHOTO_SIDE = 1600;
export const PHOTO_QUALITY = 0.85;
/** What the picker accepts before shrinking (phones convert HEIC to JPEG for this list). */
export const MAX_PICKED_BYTES = 25 * MB;
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
const PHOTO_TYPES = PHOTO_ACCEPT.split(',');

/** Why this file can't be a step photo, or null when it's fine. */
export function pickedPhotoProblem(file: { type: string; size: number; name: string }): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return `“${file.name}” isn’t a photo we can take (JPG, PNG or WebP).`;
  if (file.size > MAX_PICKED_BYTES) return `“${file.name}” is too big — choose a photo under ${MAX_PICKED_BYTES / MB} MB.`;
  return null;
}

/** The size to draw a w×h photo at so its longest side is at most `max` — never enlarged. */
export function fitWithin(width: number, height: number, max = MAX_PHOTO_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
