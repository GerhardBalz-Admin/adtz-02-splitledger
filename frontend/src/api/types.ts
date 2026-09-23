// Shapes exchanged with the backend. The mock server returns exactly these,
// so the real FastAPI backend can implement the same contract later.

import type { CurrencyCode } from '../lib/money';

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface Session {
  token: string;
  user: User;
}

export interface GroupSummary {
  id: string;
  name: string;
  currency: CurrencyCode;
  isCreator: boolean;
  memberCount: number;
  expenseCount: number;
  /** The signed-in user's net balance in minor units. */
  myBalance: number;
}

export interface Member {
  id: string;
  displayName: string;
  email: string;
  joinedAt: string;
}

export interface Expense {
  id: string;
  description: string;
  amountMinor: number;
  date: string;
  payerId: string;
  /** Participant member ids in group join order. */
  participantIds: string[];
  createdAt: string;
}

export interface MemberBalance {
  memberId: string;
  balance: number;
}

export interface GroupDetail {
  id: string;
  name: string;
  currency: CurrencyCode;
  createdBy: string;
  isCreator: boolean;
  currencyLocked: boolean;
  /** Present only when the signed-in user created the group. */
  inviteCode?: string;
  /** Members in join order. */
  members: Member[];
  /** Newest date first. */
  expenses: Expense[];
  balances: MemberBalance[];
}

export interface ExpenseInput {
  description: string;
  amountMinor: number;
  date: string;
  participantIds: string[];
}

export interface JoinResult {
  group: GroupSummary;
  alreadyMember: boolean;
}
