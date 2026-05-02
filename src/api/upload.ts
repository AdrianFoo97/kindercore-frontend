import { ApiError } from './client.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * Resolve an uploaded asset URL (e.g. `/uploads/badges/x.png`) to an absolute
 * URL that the browser can load. Absolute URLs are returned unchanged.
 *
 * Why: the backend stores relative paths, but in dev the frontend runs on a
 * different origin (localhost:5173) than the backend (localhost:4000), and
 * the browser resolves relative img.src against the page origin — so we have
 * to prepend the API base, the same way apiFetch does.
 */
export function uploadUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Upload a badge image. Returns the public URL (e.g. `/uploads/badges/xxx.png`)
 * which can be stored in `Position.badgeUrl`. Server enforces image type and 1 MB limit.
 */
export async function uploadBadge(file: File): Promise<{ url: string }> {
  const token = localStorage.getItem('token');
  const form = new FormData();
  form.append('image', file);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/upload/badge`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
  } catch {
    throw new ApiError('Unable to connect to server.', 0, 'NETWORK_ERROR');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: 'Upload failed' }));
    throw new ApiError(body.message ?? 'Upload failed', res.status, body.code);
  }
  return res.json();
}
