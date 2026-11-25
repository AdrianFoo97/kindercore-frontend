// Report a Bug → attachments: screenshots or a short screen recording. The
// server checks the same (upload.routes bug-report-photos). Pure.

const MB = 1024 * 1024;
export const MAX_BUG_PHOTO_BYTES = 5 * MB;
export const MAX_BUG_VIDEO_BYTES = 50 * MB;
const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
/** For the file picker — phones then offer the camera, gallery and screen recordings. */
export const BUG_MEDIA_ACCEPT = [...PHOTO_TYPES, ...VIDEO_TYPES].join(',');

/** Whether a stored attachment is a video (by its file ending). */
export const isVideoUrl = (url: string) => /\.(mp4|mov|webm)$/i.test(url);

/** Why this file can't be attached, or null when it's fine — checked before uploading. */
export function bugFileProblem(f: { name: string; type: string; size: number }): string | null {
  if (VIDEO_TYPES.includes(f.type)) return f.size > MAX_BUG_VIDEO_BYTES ? `“${f.name}” is too big — a video must be under ${MAX_BUG_VIDEO_BYTES / MB} MB. Try a shorter clip.` : null;
  if (PHOTO_TYPES.includes(f.type)) return f.size > MAX_BUG_PHOTO_BYTES ? `“${f.name}” is too big — a photo must be under ${MAX_BUG_PHOTO_BYTES / MB} MB.` : null;
  return `“${f.name}” isn’t a photo or video we can take (PNG, JPG, WebP, MP4, MOV, WebM).`;
}
