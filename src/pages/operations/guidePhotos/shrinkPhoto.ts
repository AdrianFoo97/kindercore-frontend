import { MAX_PHOTO_SIDE, PHOTO_QUALITY, fitWithin } from './guidePhotoRules.js';

/**
 * Shrink a picked photo to MAX_PHOTO_SIDE as a JPEG before uploading. A white
 * background goes under it first, so a transparent PNG doesn't turn black.
 */
export async function shrinkPhoto(file: File, maxSide = MAX_PHOTO_SIDE): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser can’t prepare the photo.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob(
    b => (b ? resolve(b) : reject(new Error('Couldn’t prepare the photo.'))), 'image/jpeg', PHOTO_QUALITY,
  ));
}
