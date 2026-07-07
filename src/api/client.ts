const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = localStorage.getItem('token');

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers ?? {}),
      },
    });
  } catch {
    // Bubble the network error to the caller — do NOT open a native
    // alert() here. Public surfaces (apply form, landing) render their
    // own candidate-friendly copy; admin surfaces show toasts / inline
    // error state. An admin-toned "contact your administrator" alert
    // would be wildly wrong voice on the apply page.
    throw new ApiError('Unable to connect to server.', 0, 'NETWORK_ERROR');
  }

  if (!res.ok) {
    // Auto-logout on expired/invalid token (but not on the login endpoint)
    if (res.status === 401 && !path.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new ApiError('Session expired. Please sign in again.', 401, 'SESSION_EXPIRED');
    }

    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    const body = err as { message?: string; code?: string; errors?: { message: string }[] };
    const detail = Array.isArray(body.errors) && body.errors.length > 0
      ? ': ' + body.errors.map(e => e.message).join(', ')
      : '';
    throw new ApiError((body.message ?? 'Request failed') + detail, res.status, body.code);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
