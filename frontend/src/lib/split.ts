// Equal split with deterministic remainder handling.
//
// `participantIds` must already be in group join order. Each participant gets
// floor(total / n); the leftover minor units go one each to the first
// participants in that order, so the shares always add up to the total.

export interface Share {
  memberId: string;
  amount: number;
  extraCents: number;
}

export function splitEqually(totalMinor: number, participantIds: string[]): Share[] {
  if (!Number.isInteger(totalMinor) || totalMinor <= 0) {
    throw new Error('Total must be a positive whole number of minor units');
  }
  if (participantIds.length === 0) {
    throw new Error('At least one participant is required');
  }
  const n = participantIds.length;
  const base = Math.floor(totalMinor / n);
  const remainder = totalMinor - base * n;
  return participantIds.map((memberId, index) => {
    const extraCents = index < remainder ? 1 : 0;
    return { memberId, amount: base + extraCents, extraCents };
  });
}

export interface BalanceExpense {
  payerId: string;
  amountMinor: number;
  participantIds: string[];
}

/**
 * Net balance per member: amount paid minus allocated shares.
 * `memberIds` is the group's join order and is used to order participants.
 */
export function computeBalances(memberIds: string[], expenses: BalanceExpense[]): Map<string, number> {
  const balances = new Map(memberIds.map((id) => [id, 0]));
  const joinIndex = new Map(memberIds.map((id, i) => [id, i]));
  for (const expense of expenses) {
    balances.set(expense.payerId, (balances.get(expense.payerId) ?? 0) + expense.amountMinor);
    const ordered = [...expense.participantIds].sort(
      (a, b) => (joinIndex.get(a) ?? Infinity) - (joinIndex.get(b) ?? Infinity),
    );
    for (const share of splitEqually(expense.amountMinor, ordered)) {
      balances.set(share.memberId, (balances.get(share.memberId) ?? 0) - share.amount);
    }
  }
  return balances;
}
