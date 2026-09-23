// The single place where the frontend talks to the backend.
//
// Every call goes through `request`, which sends it with `fetch` to the FastAPI
// backend at API_BASE_URL. The endpoint paths and payloads below follow the
// contract in /openapi.yaml.

import type { CurrencyCode } from '../lib/money';
import type {
  Expense,
  ExpenseInput,
  GroupDetail,
  GroupSummary,
  JoinResult,
  Session,
  User,
} from './types';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const TOKEN_KEY = 'splitledger.token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable: the session lasts only for this page load.
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Base URL of the backend API. Set VITE_API_BASE_URL to point the frontend elsewhere. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/+$/, '');

/** Status of an ApiError raised when the backend cannot be reached at all. */
export const NETWORK_ERROR_STATUS = 0;

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = readToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      NETWORK_ERROR_STATUS,
      `Cannot reach the SplitLedger backend at ${API_BASE_URL}. Check that it is running.`,
    );
  }

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (response.status === 401 && token) writeToken(null);
  if (!response.ok) {
    const detail = (data as { detail?: unknown } | undefined)?.detail;
    throw new ApiError(response.status, typeof detail === 'string' ? detail : 'Request failed');
  }
  return data as T;
}

export const api = {
  async signUp(email: string, password: string): Promise<User> {
    const session = await request<Session>('POST', '/auth/signup', { email, password });
    writeToken(session.token);
    return session.user;
  },

  async signIn(email: string, password: string): Promise<User> {
    const session = await request<Session>('POST', '/auth/signin', { email, password });
    writeToken(session.token);
    return session.user;
  },

  async signOut(): Promise<void> {
    try {
      await request<void>('POST', '/auth/signout');
    } finally {
      writeToken(null);
    }
  },

  /** Returns the signed-in user, or null when there is no valid session. */
  async currentUser(): Promise<User | null> {
    if (!readToken()) return null;
    try {
      return await request<User>('GET', '/auth/me');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },

  listGroups(): Promise<GroupSummary[]> {
    return request('GET', '/groups');
  },

  createGroup(name: string, currency: CurrencyCode): Promise<GroupDetail> {
    return request('POST', '/groups', { name, currency });
  },

  joinGroup(inviteCode: string): Promise<JoinResult> {
    return request('POST', '/groups/join', { inviteCode });
  },

  getGroup(groupId: string): Promise<GroupDetail> {
    return request('GET', `/groups/${encodeURIComponent(groupId)}`);
  },

  changeCurrency(groupId: string, currency: CurrencyCode): Promise<GroupDetail> {
    return request('PATCH', `/groups/${encodeURIComponent(groupId)}`, { currency });
  },

  /** The payer is always the signed-in user; the server never accepts a payer field. */
  createExpense(groupId: string, input: ExpenseInput): Promise<Expense> {
    return request('POST', `/groups/${encodeURIComponent(groupId)}/expenses`, input);
  },

  updateExpense(groupId: string, expenseId: string, input: ExpenseInput): Promise<Expense> {
    return request(
      'PATCH',
      `/groups/${encodeURIComponent(groupId)}/expenses/${encodeURIComponent(expenseId)}`,
      input,
    );
  },

  deleteExpense(groupId: string, expenseId: string): Promise<void> {
    return request(
      'DELETE',
      `/groups/${encodeURIComponent(groupId)}/expenses/${encodeURIComponent(expenseId)}`,
    );
  },
};
