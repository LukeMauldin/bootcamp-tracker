import { firebaseAuth } from "./firebase";

async function authHeaders(): Promise<HeadersInit> {
  const token = await firebaseAuth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: await authHeaders()
  });
  return parseResponse<T>(response);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders())
    },
    body: JSON.stringify(body)
  });
  return parseResponse<T>(response);
}

export async function apiForm<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: await authHeaders(),
    body: formData
  });
  return parseResponse<T>(response);
}

export async function apiBlob(path: string): Promise<Blob> {
  const response = await fetch(path, {
    headers: await authHeaders()
  });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.blob();
}
