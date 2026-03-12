import { apiFetch } from './client.js';
import { User } from '../types/index.js';

export interface LoginResponse {
  token: string;
  user: User;
}

export function login(email: string, password: string) {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
