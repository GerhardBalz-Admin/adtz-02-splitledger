// The single place where the frontend talks to the backend.
//
// Every call goes through `request`, which currently hands the request to the
// in-browser mock server. To switch to the real backend, replace the body of
// `request` with a `fetch` to the API base URL; the endpoint paths and payloads
// below are the contract the backend must implement.

import type { CurrencyCode } from '../lib/money';
import { handleMockRequest } from './mockServer';
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

const MOCK_LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 150;

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = readToken();
  const response = handleMockRequest({ method, path, body, token });
  if (MOCK_LATENCY_MS > 0) await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
  if (response.status === 401 && token) writeToken(null);
  if (response.status >= 400) {
    const detail = (response.body as { detail?: string } | undefined)?.detail ?? 'Request failed';
    throw new ApiError(response.status, detail);
  }
  return response.body as T;
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
