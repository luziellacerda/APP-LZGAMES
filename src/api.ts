import * as SecureStore from 'expo-secure-store';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://turbobox.lzgames.com.br/api/mobile/v1';
const TOKEN_KEY = 'lz_games_access_token';

export type User = { id: number; name: string; email: string; phone: string; document: string };
export type Purchase = { id: number; amount_cents: number; status: string; purchased_at: string; expires_at: string | null; product_name: string; product_description: string };
export type Course = { id: number; name: string; description: string; total_lessons: number; completed_lessons: number };
export type License = { opaque_ref: string; license_id: string; state: string; financial_state: string; updated_at: string };
export type HomeData = { user: User; services: { turbobox: { library: Course[]; purchases: Purchase[] }; turborama: { licenses: License[] } } };

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
  });
  const payload = await response.json() as Envelope<T>;
  if (!response.ok || !payload.ok) throw new Error(!payload.ok ? payload.error.message : 'Não foi possível acessar o servidor.');
  return payload.data;
}

export async function login(loginValue: string, password: string) {
  const data = await request<{token: string; expiresAt: string | null; user: User}>('/auth/login', {
    method: 'POST', body: JSON.stringify({ login: loginValue, password, deviceName: 'LZ Games App' }),
  });
  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  return data.user;
}

export const loadHome = () => request<HomeData>('/home');
export const hasSession = async () => Boolean(await SecureStore.getItemAsync(TOKEN_KEY));
export async function logout() {
  try { await request<Record<string, never>>('/auth/logout', { method: 'POST', body: '{}' }); } finally { await SecureStore.deleteItemAsync(TOKEN_KEY); }
}
