// In-browser stand-in for the SplitLedger backend.
//
// It behaves like the future REST API: it authenticates by session token,
// enforces membership and ownership rules, and keeps its data in
// localStorage so it survives a page reload. Only `api/client.ts` calls it.

import { isIsoDate } from '../lib/dates';
import { isCurrencyCode, type CurrencyCode } from '../lib/money';
import { computeBalances } from '../lib/split';
import type { Expense, GroupDetail, GroupSummary, Member, User } from './types';

interface UserRow {
  id: string;
  email: string;
  // Plain text only because this is a local mock; the real backend must hash passwords.
  password: string;
}

interface GroupRow {
  id: string;
  name: string;
  currency: CurrencyCode;
  createdBy: string;
  inviteCode: string;
  hasRecordedExpense: boolean;
}

interface MembershipRow {
  groupId: string;
  userId: string;
  joinedAt: string;
}

interface ExpenseRow extends Expense {
  groupId: string;
}

interface Database {
  users: UserRow[];
  sessions: Record<string, string>;
  groups: GroupRow[];
  /** Kept in join order. */
  memberships: MembershipRow[];
  expenses: ExpenseRow[];
}

export interface MockRequest {
  method: string;
  path: string;
  body?: unknown;
  token: string | null;
}

export interface MockResponse {
  status: number;
  body?: unknown;
}

const STORAGE_KEY = 'splitledger.mockdb.v1';
export const DEMO_PASSWORD = 'splitledger';

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
  }
}

let idCounter = 0;
function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10);
  idCounter += 1;
  return `${prefix}_${random}${idCounter.toString(36)}`;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newInviteCode(db: Database): string {
  for (;;) {
    let raw = '';
    for (let i = 0; i < 8; i += 1) raw += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    if (!db.groups.some((g) => g.inviteCode === code)) return code;
  }
}

function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function displayNameFor(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

// ---------------------------------------------------------------------------
// Seed data mirrors the design: Flat 4B balances +81.66, +16.67, −48.33, −50.00.

function seedDatabase(): Database {
  const users: UserRow[] = ['dana', 'anna', 'ben', 'chiara'].map((name) => ({
    id: `u_${name}`,
    email: `${name}@example.com`,
    password: DEMO_PASSWORD,
  }));
  const groups: GroupRow[] = [
    { id: 'g_flat4b', name: 'Flat 4B', currency: 'CHF', createdBy: 'u_dana', inviteCode: 'K7QM-4RX2', hasRecordedExpense: true },
    { id: 'g_ticino', name: 'Ticino weekend', currency: 'EUR', createdBy: 'u_ben', inviteCode: 'T3NW-8HPD', hasRecordedExpense: true },
  ];
  const memberships: MembershipRow[] = [
    { groupId: 'g_flat4b', userId: 'u_dana', joinedAt: '2026-08-28T09:00:00Z' },
    { groupId: 'g_flat4b', userId: 'u_anna', joinedAt: '2026-08-28T10:00:00Z' },
    { groupId: 'g_flat4b', userId: 'u_ben', joinedAt: '2026-08-29T08:00:00Z' },
    { groupId: 'g_flat4b', userId: 'u_chiara', joinedAt: '2026-08-30T18:00:00Z' },
    { groupId: 'g_ticino', userId: 'u_ben', joinedAt: '2026-09-02T12:00:00Z' },
    { groupId: 'g_ticino', userId: 'u_dana', joinedAt: '2026-09-02T13:00:00Z' },
    { groupId: 'g_ticino', userId: 'u_chiara', joinedAt: '2026-09-03T07:30:00Z' },
  ];
  const expense = (
    id: string,
    groupId: string,
    description: string,
    amountMinor: number,
    date: string,
    payerId: string,
    participantIds: string[],
  ): ExpenseRow => ({
    id,
    groupId,
    description,
    amountMinor,
    date,
    payerId,
    participantIds,
    createdAt: `${date}T12:00:00Z`,
  });
  const everyoneInFlat = ['u_dana', 'u_anna', 'u_ben', 'u_chiara'];
  const everyoneInTicino = ['u_ben', 'u_dana', 'u_chiara'];
  const expenses: ExpenseRow[] = [
    expense('e_groceries', 'g_flat4b', 'Groceries', 9000, '2026-09-21', 'u_dana', ['u_dana', 'u_anna', 'u_ben']),
    expense('e_cleaning', 'g_flat4b', 'Cleaning supplies', 1000, '2026-09-18', 'u_ben', ['u_dana', 'u_anna', 'u_ben']),
    expense('e_concert', 'g_flat4b', 'Concert tickets', 5000, '2026-09-12', 'u_dana', ['u_anna', 'u_chiara']),
    expense('e_internet', 'g_flat4b', 'Internet, September', 10000, '2026-09-01', 'u_anna', everyoneInFlat),
    expense('e_train', 'g_ticino', 'Train tickets', 13680, '2026-09-05', 'u_ben', everyoneInTicino),
    expense('e_dinner', 'g_ticino', 'Dinner in Locarno', 9800, '2026-09-06', 'u_chiara', everyoneInTicino),
  ];
  return { users, sessions: {}, groups, memberships, expenses };
}

// ---------------------------------------------------------------------------
// Persistence

let memoryDb: Database | null = null;

function load(): Database {
  if (memoryDb) return memoryDb;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      memoryDb = JSON.parse(raw) as Database;
      // Old mock data did not track deleted expenses. An absent flag cannot
      // prove the group never had an expense, so keep its currency locked.
      for (const group of memoryDb.groups) {
        if (typeof group.hasRecordedExpense !== 'boolean') group.hasRecordedExpense = true;
      }
      save(memoryDb);
      return memoryDb;
    }
  } catch {
    // Fall through to fresh seed data.
  }
  memoryDb = seedDatabase();
  save(memoryDb);
  return memoryDb;
}

function save(db: Database): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage unavailable: data lives in memory for this page load only.
  }
}

/** Restores the demo data and signs everyone out. */
export function resetMockDatabase(): void {
  memoryDb = seedDatabase();
  save(memoryDb);
}

// ---------------------------------------------------------------------------
// Helpers

function toUser(row: UserRow): User {
  return { id: row.id, email: row.email, displayName: displayNameFor(row.email) };
}

function requireUser(db: Database, token: string | null): UserRow {
  const userId = token ? db.sessions[token] : undefined;
  const user = userId ? db.users.find((u) => u.id === userId) : undefined;
  if (!user) throw new HttpError(401, 'Please sign in.');
  return user;
}

function groupMembers(db: Database, groupId: string): MembershipRow[] {
  return db.memberships.filter((m) => m.groupId === groupId);
}

/** Returns the group only if the user is a member; nonmembers get a 404 so the group stays hidden. */
function requireMemberGroup(db: Database, groupId: string, userId: string): GroupRow {
  const group = db.groups.find((g) => g.id === groupId);
  if (!group || !groupMembers(db, groupId).some((m) => m.userId === userId)) {
    throw new HttpError(404, 'Group not found.');
  }
  return group;
}

function groupExpenses(db: Database, groupId: string): ExpenseRow[] {
  return db.expenses
    .filter((e) => e.groupId === groupId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function balancesFor(db: Database, groupId: string): Map<string, number> {
  const memberIds = groupMembers(db, groupId).map((m) => m.userId);
  return computeBalances(memberIds, groupExpenses(db, groupId));
}

function summary(db: Database, group: GroupRow, userId: string): GroupSummary {
  return {
    id: group.id,
    name: group.name,
    currency: group.currency,
    isCreator: group.createdBy === userId,
    memberCount: groupMembers(db, group.id).length,
    expenseCount: groupExpenses(db, group.id).length,
    myBalance: balancesFor(db, group.id).get(userId) ?? 0,
  };
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    description: row.description,
    amountMinor: row.amountMinor,
    date: row.date,
    payerId: row.payerId,
    participantIds: [...row.participantIds],
    createdAt: row.createdAt,
  };
}

function detail(db: Database, group: GroupRow, userId: string): GroupDetail {
  const memberships = groupMembers(db, group.id);
  const members: Member[] = memberships.map((m) => {
    const user = db.users.find((u) => u.id === m.userId)!;
    return { id: user.id, email: user.email, displayName: displayNameFor(user.email), joinedAt: m.joinedAt };
  });
  const balances = balancesFor(db, group.id);
  const isCreator = group.createdBy === userId;
  return {
    id: group.id,
    name: group.name,
    currency: group.currency,
    createdBy: group.createdBy,
    isCreator,
    currencyLocked: group.hasRecordedExpense,
    ...(isCreator ? { inviteCode: group.inviteCode } : {}),
    members,
    expenses: groupExpenses(db, group.id).map(toExpense),
    balances: members.map((m) => ({ memberId: m.id, balance: balances.get(m.id) ?? 0 })),
  };
}

function asRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readCredentials(body: unknown): { email: string; password: string } {
  const { email, password } = asRecord(body);
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new HttpError(422, 'Enter an email and a password.');
  }
  return { email: email.trim().toLowerCase(), password };
}

/** Validates an expense payload. Any client-supplied payer field is ignored. */
function readExpenseInput(db: Database, groupId: string, body: unknown) {
  const { description, amountMinor, date, participantIds } = asRecord(body);
  if (typeof description !== 'string' || description.trim().length === 0) {
    throw new HttpError(422, 'Enter a description.');
  }
  if (description.trim().length > 120) throw new HttpError(422, 'Keep the description under 120 characters.');
  if (typeof amountMinor !== 'number' || !Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new HttpError(422, 'Enter an amount greater than zero.');
  }
  if (amountMinor > 99_999_999_999) throw new HttpError(422, 'That amount is too large.');
  if (typeof date !== 'string' || !isIsoDate(date)) throw new HttpError(422, 'Enter a valid date.');
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    throw new HttpError(422, 'Select at least one member who shares this expense.');
  }
  const memberOrder = groupMembers(db, groupId).map((m) => m.userId);
  const selected = new Set(participantIds);
  if (selected.size !== participantIds.length || participantIds.some((id) => !memberOrder.includes(id as string))) {
    throw new HttpError(422, 'Participants must be distinct members of this group.');
  }
  return {
    description: description.trim(),
    amountMinor,
    date,
    participantIds: memberOrder.filter((id) => selected.has(id)),
  };
}

// ---------------------------------------------------------------------------
// Routing

function routeAuth(db: Database, req: MockRequest, action: string | undefined): MockResponse {
  const { method, body, token } = req;
  if (method === 'POST' && action === 'signup') {
    const { email, password } = readCredentials(body);
    if (!EMAIL_PATTERN.test(email)) throw new HttpError(422, 'Enter a valid email address.');
    if (password.length < 8) throw new HttpError(422, 'Use a password with at least 8 characters.');
    if (db.users.some((u) => u.email === email)) {
      throw new HttpError(409, 'An account with this email already exists. Sign in instead.');
    }
    const user: UserRow = { id: newId('u'), email, password };
    db.users.push(user);
    const sessionToken = newId('t');
    db.sessions[sessionToken] = user.id;
    return { status: 201, body: { token: sessionToken, user: toUser(user) } };
  }
  if (method === 'POST' && action === 'signin') {
    const { email, password } = readCredentials(body);
    const user = db.users.find((u) => u.email === email && u.password === password);
    if (!user) throw new HttpError(401, 'Email or password is incorrect.');
    const sessionToken = newId('t');
    db.sessions[sessionToken] = user.id;
    return { status: 200, body: { token: sessionToken, user: toUser(user) } };
  }
  if (method === 'POST' && action === 'signout') {
    if (token) delete db.sessions[token];
    return { status: 204 };
  }
  if (method === 'GET' && action === 'me') {
    return { status: 200, body: toUser(requireUser(db, token)) };
  }
  throw new HttpError(404, 'Not found.');
}

function routeGroups(db: Database, req: MockRequest, parts: string[]): MockResponse {
  const { method, body, token } = req;
  const user = requireUser(db, token);

  if (parts.length === 1 && method === 'GET') {
    const mine = new Set(db.memberships.filter((m) => m.userId === user.id).map((m) => m.groupId));
    const groups = db.groups.filter((g) => mine.has(g.id)).map((g) => summary(db, g, user.id));
    return { status: 200, body: groups };
  }

  if (parts.length === 1 && method === 'POST') {
    const { name, currency } = asRecord(body);
    if (typeof name !== 'string' || name.trim().length === 0) throw new HttpError(422, 'Enter a group name.');
    if (name.trim().length > 60) throw new HttpError(422, 'Keep the group name under 60 characters.');
    if (typeof currency !== 'string' || !isCurrencyCode(currency)) throw new HttpError(422, 'Choose a currency.');
    const group: GroupRow = {
      id: newId('g'),
      name: name.trim(),
      currency,
      createdBy: user.id,
      inviteCode: newInviteCode(db),
      hasRecordedExpense: false,
    };
    db.groups.push(group);
    db.memberships.push({ groupId: group.id, userId: user.id, joinedAt: new Date().toISOString() });
    return { status: 201, body: detail(db, group, user.id) };
  }

  if (parts.length === 2 && parts[1] === 'join' && method === 'POST') {
    const { inviteCode } = asRecord(body);
    const code = typeof inviteCode === 'string' ? normalizeCode(inviteCode) : '';
    const group = code ? db.groups.find((g) => normalizeCode(g.inviteCode) === code) : undefined;
    if (!group) throw new HttpError(404, "That code doesn't match any group. Check it and try again.");
    const alreadyMember = groupMembers(db, group.id).some((m) => m.userId === user.id);
    if (!alreadyMember) {
      db.memberships.push({ groupId: group.id, userId: user.id, joinedAt: new Date().toISOString() });
    }
    return { status: alreadyMember ? 200 : 201, body: { group: summary(db, group, user.id), alreadyMember } };
  }

  const group = requireMemberGroup(db, parts[1], user.id);

  if (parts.length === 2 && method === 'GET') {
    return { status: 200, body: detail(db, group, user.id) };
  }

  if (parts.length === 2 && method === 'PATCH') {
    const { currency } = asRecord(body);
    if (group.createdBy !== user.id) throw new HttpError(403, 'Only the group creator can change the currency.');
    if (typeof currency !== 'string' || !isCurrencyCode(currency)) throw new HttpError(422, 'Choose a currency.');
    if (currency !== group.currency && group.hasRecordedExpense) {
      throw new HttpError(409, 'The currency cannot change once expenses have been recorded.');
    }
    group.currency = currency;
    return { status: 200, body: detail(db, group, user.id) };
  }

  if (parts[2] === 'expenses' && parts.length === 3 && method === 'POST') {
    const row: ExpenseRow = {
      id: newId('e'),
      groupId: group.id,
      ...readExpenseInput(db, group.id, body),
      payerId: user.id,
      createdAt: new Date().toISOString(),
    };
    db.expenses.push(row);
    group.hasRecordedExpense = true;
    return { status: 201, body: toExpense(row) };
  }

  if (parts[2] === 'expenses' && parts.length === 4) {
    const row = db.expenses.find((e) => e.id === parts[3] && e.groupId === group.id);
    if (!row) throw new HttpError(404, 'Expense not found.');
    if (method === 'GET') return { status: 200, body: toExpense(row) };
    if (row.payerId !== user.id) {
      throw new HttpError(403, 'Only the member who entered this expense can change it.');
    }
    if (method === 'PATCH') {
      Object.assign(row, readExpenseInput(db, group.id, body));
      return { status: 200, body: toExpense(row) };
    }
    if (method === 'DELETE') {
      db.expenses = db.expenses.filter((e) => e !== row);
      return { status: 204 };
    }
  }

  throw new HttpError(404, 'Not found.');
}

export function handleMockRequest(req: MockRequest): MockResponse {
  // Work on a copy so a failed request leaves the stored data untouched.
  const draft = structuredClone(load());
  const parts = req.path.split('/').filter(Boolean).map(decodeURIComponent);
  try {
    let response: MockResponse;
    if (parts[0] === 'auth') response = routeAuth(draft, req, parts[1]);
    else if (parts[0] === 'groups') response = routeGroups(draft, req, parts);
    else throw new HttpError(404, 'Not found.');
    if (req.method !== 'GET') {
      memoryDb = draft;
      save(draft);
    }
    return response;
  } catch (error) {
    if (error instanceof HttpError) return { status: error.status, body: { detail: error.message } };
    throw error;
  }
}
