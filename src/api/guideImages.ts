import { ApiError, fetchPrivateFile, withSession } from './client.js';

// How-To Guide step photos — mirrors sop-steps.controller.ts (uploadStepImage /
// getStepImage). Stored on the server as soon as they're picked; a step (or a
// proposal) then refers to the photo by id.

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export async function uploadGuideImage(photo: Blob, name: string): Promise<string> {
  const form = new FormData();
  form.append('image', photo, name);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/sop-steps/images`, withSession({ method: 'POST', body: form }));
  } catch {
    throw new ApiError('Unable to connect to server.', 0, 'NETWORK_ERROR');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status === 413 ? 'That photo is too large to upload.' : body.message ?? 'Couldn’t add the photo.', res.status);
  return (body as { id: string }).id;
}

/** A step photo as a Blob — private, so an <img src> can't load it directly. */
export function fetchGuideImage(id: string): Promise<Blob> {
  return fetchPrivateFile(`${BASE_URL}/api/sop-steps/images/${encodeURIComponent(id)}`, 'Couldn’t load this photo.');
}
