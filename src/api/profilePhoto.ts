import { ApiError, apiFetch, withSession } from './client.js';

// My Profile → your own photo (backend profilePhoto.controller). Always the
// signed-in person's own — there's no user id in these addresses.

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const PATH = '/api/auth/me/photo';

/** Your photo, or null when you haven't set one. */
export async function fetchMyPhoto(): Promise<Blob | null> {
  const res = await fetch(`${BASE_URL}${PATH}`, withSession());
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError('Couldn’t load your photo.', res.status);
  return res.blob();
}

export async function uploadMyPhoto(photo: Blob): Promise<void> {
  const form = new FormData();
  form.append('photo', photo, 'profile.jpg');
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${PATH}`, withSession({ method: 'PUT', body: form }));
  } catch {
    throw new ApiError('Unable to connect to server.', 0, 'NETWORK_ERROR');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status === 413 ? 'That photo is too large to upload.' : body.message ?? 'Couldn’t save your photo.', res.status);
  }
}

export const removeMyPhoto = () => apiFetch<{ ok: true }>(PATH, { method: 'DELETE' });

/** The name the app shows you by — null (or blank) goes back to your full name. */
export const saveMyDisplayName = (displayName: string | null) =>
  apiFetch<{ displayName: string | null }>('/api/auth/me/display-name', { method: 'PUT', body: JSON.stringify({ displayName }) });
