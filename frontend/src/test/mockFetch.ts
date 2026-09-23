// A `fetch` replacement that routes API calls to the in-memory mock backend,
// so unit tests exercise the real client code without a running server.

import { API_BASE_URL } from '../api/client';
import { handleMockRequest } from './mockServer';

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
}

export function createMockFetch(calls: RecordedCall[] = []): typeof fetch {
  return async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const headers = { ...(init?.headers as Record<string, string> | undefined) };
    calls.push({ url, method, headers });
    if (!url.startsWith(`${API_BASE_URL}/`)) throw new TypeError(`Unexpected URL ${url}`);

    const path = url.slice(API_BASE_URL.length);
    const auth = headers.Authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const result = handleMockRequest({ method, path, body, token });
    const payload = result.body === undefined ? null : JSON.stringify(result.body);
    return new Response(payload, {
      status: result.status,
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    });
  };
}
