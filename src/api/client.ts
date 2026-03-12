const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(
      (err as { message?: string }).message ?? 'Request failed',
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
