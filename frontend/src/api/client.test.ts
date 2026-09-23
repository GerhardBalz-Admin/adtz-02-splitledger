import { API_BASE_URL, ApiError, NETWORK_ERROR_STATUS, api } from './client';
import { createMockFetch, type RecordedCall } from '../test/mockFetch';
import { DEMO_PASSWORD, resetMockDatabase } from '../test/mockServer';

async function expectStatus(promise: Promise<unknown>, status: number) {
  await expect(promise).rejects.toSatisfy((e: unknown) => e instanceof ApiError && e.status === status);
}

let calls: RecordedCall[];

beforeEach(() => {
  localStorage.clear();
  resetMockDatabase();
  calls = [];
  vi.stubGlobal('fetch', createMockFetch(calls));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('http requests', () => {
  it('calls the FastAPI backend under /api with the session token', async () => {
    expect(API_BASE_URL).toBe('http://localhost:8000/api');
    await api.signIn('dana@example.com', DEMO_PASSWORD);
    await api.listGroups();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST http://localhost:8000/api/auth/signin',
      'GET http://localhost:8000/api/groups',
    ]);
    expect(calls[0].headers.Authorization).toBeUndefined();
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(calls[1].headers.Authorization).toMatch(/^Bearer .+/);
  });

  it('reports an unreachable backend and a server error detail', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(api.listGroups()).rejects.toMatchObject({
      status: NETWORK_ERROR_STATUS,
      message: expect.stringContaining('http://localhost:8000/api'),
    });

    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ detail: 'Group not found.' }), { status: 404 }));
    await expect(api.getGroup('g_missing')).rejects.toMatchObject({ status: 404, message: 'Group not found.' });
  });

  it('forgets the stored token when the backend rejects it', async () => {
    await api.signIn('dana@example.com', DEMO_PASSWORD);
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ detail: 'Sign in again.' }), { status: 401 }));
    expect(await api.currentUser()).toBeNull();
    expect(localStorage.getItem('splitledger.token')).toBeNull();
  });
});

describe('api client against the mock backend', () => {
  it('signs up, signs in and out, and lists only joined groups', async () => {
    await api.signUp('erin@example.com', 'long-enough');
    expect(await api.listGroups()).toEqual([]);
    await api.createGroup('Trip', 'EUR');
    await api.createGroup('Flat', 'CHF');
    expect((await api.listGroups()).map((g) => g.name)).toEqual(['Trip', 'Flat']);

    await api.signOut();
    expect(await api.currentUser()).toBeNull();
    await expectStatus(api.signIn('erin@example.com', 'wrong-password'), 401);
    await api.signIn('erin@example.com', 'long-enough');
    expect((await api.currentUser())?.email).toBe('erin@example.com');
  });

  it('shows the invite code only to the creator and joins without duplicates', async () => {
    await api.signIn('dana@example.com', DEMO_PASSWORD);
    const created = await api.createGroup('Board games', 'USD');
    expect(created.inviteCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    await api.signUp('erin@example.com', 'long-enough');
    await expectStatus(api.getGroup(created.id), 404);
    await expectStatus(api.joinGroup('NOPE-0000'), 404);
    expect(await api.listGroups()).toEqual([]);

    const first = await api.joinGroup(created.inviteCode!.toLowerCase());
    expect(first.alreadyMember).toBe(false);
    const again = await api.joinGroup(created.inviteCode!);
    expect(again.alreadyMember).toBe(true);

    const seen = await api.getGroup(created.id);
    expect(seen.inviteCode).toBeUndefined();
    expect(seen.members.map((m) => m.email)).toEqual(['dana@example.com', 'erin@example.com']);
  });

  it('takes the payer from the session and recalculates balances on add, edit, delete', async () => {
    await api.signIn('ben@example.com', DEMO_PASSWORD);
    const input = {
      description: 'Snacks',
      amountMinor: 1000,
      date: '2026-09-01',
      participantIds: ['u_chiara', 'u_dana', 'u_anna'],
      payerId: 'u_dana',
    };
    const expense = await api.createExpense('g_flat4b', input);
    expect(expense.payerId).toBe('u_ben');
    expect(expense.participantIds).toEqual(['u_dana', 'u_anna', 'u_chiara']);

    let group = await api.getGroup('g_flat4b');
    const balanceOf = (id: string) => group.balances.find((b) => b.memberId === id)!.balance;
    expect(balanceOf('u_ben')).toBe(-4833 + 1000);
    expect(balanceOf('u_dana')).toBe(8166 - 334);
    expect(group.balances.reduce((sum, b) => sum + b.balance, 0)).toBe(0);

    await api.updateExpense('g_flat4b', expense.id, { ...input, amountMinor: 3000, participantIds: ['u_ben'] });
    group = await api.getGroup('g_flat4b');
    expect(balanceOf('u_ben')).toBe(-4833);
    expect(group.balances.reduce((sum, b) => sum + b.balance, 0)).toBe(0);

    await api.deleteExpense('g_flat4b', expense.id);
    group = await api.getGroup('g_flat4b');
    expect(group.expenses).toHaveLength(4);
    expect(group.balances.map((b) => b.balance)).toEqual([8166, 1667, -4833, -5000]);
  });

  it('lets only the creator of an expense edit or delete it', async () => {
    await api.signIn('ben@example.com', DEMO_PASSWORD);
    const input = { description: 'Hack', amountMinor: 100, date: '2026-09-01', participantIds: ['u_ben'] };
    await expectStatus(api.updateExpense('g_flat4b', 'e_groceries', input), 403);
    await expectStatus(api.deleteExpense('g_flat4b', 'e_groceries'), 403);
  });

  it('validates expenses', async () => {
    await api.signIn('dana@example.com', DEMO_PASSWORD);
    const valid = { description: 'Ok', amountMinor: 100, date: '2026-09-01', participantIds: ['u_dana'] };
    await expectStatus(api.createExpense('g_flat4b', { ...valid, amountMinor: 0 }), 422);
    await expectStatus(api.createExpense('g_flat4b', { ...valid, description: '  ' }), 422);
    await expectStatus(api.createExpense('g_flat4b', { ...valid, participantIds: [] }), 422);
    await expectStatus(api.createExpense('g_flat4b', { ...valid, participantIds: ['u_stranger'] }), 422);
    await expectStatus(api.createExpense('g_flat4b', { ...valid, date: '2026-02-30' }), 422);
  });

  it('keeps the currency locked after the last expense is deleted', async () => {
    await api.signIn('dana@example.com', DEMO_PASSWORD);
    await expectStatus(api.changeCurrency('g_flat4b', 'EUR'), 409);
    const group = await api.createGroup('Empty', 'CHF');
    expect(group.currencyLocked).toBe(false);
    expect((await api.changeCurrency(group.id, 'EUR')).currency).toBe('EUR');
    const expense = await api.createExpense(group.id, { description: 'X', amountMinor: 1, date: '2026-09-01', participantIds: ['u_dana'] });
    await expectStatus(api.changeCurrency(group.id, 'USD'), 409);
    await api.deleteExpense(group.id, expense.id);
    expect((await api.getGroup(group.id)).expenses).toHaveLength(0);
    expect((await api.getGroup(group.id)).currencyLocked).toBe(true);
    await expectStatus(api.changeCurrency(group.id, 'USD'), 409);
    expect((await api.getGroup(group.id)).currency).toBe('EUR');

    await api.signIn('ben@example.com', DEMO_PASSWORD);
    await expectStatus(api.changeCurrency('g_ticino', 'CHF'), 409);
  });
});
