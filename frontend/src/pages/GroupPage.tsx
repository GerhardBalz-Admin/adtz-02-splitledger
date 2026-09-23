import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Expense, GroupDetail } from '../api/types';
import { useUser } from '../auth';
import { CopyButton } from '../components/CopyButton';
import { GroupNotFound } from '../components/NotFound';
import { formatShortDate } from '../lib/dates';
import { errorMessage } from '../lib/errors';
import { balanceTone, CURRENCIES, formatAmount, formatSigned, type CurrencyCode } from '../lib/money';
import { memberName, participantSummary } from '../lib/names';
import { useGroup } from '../lib/useGroup';

export function GroupPage() {
  const { groupId } = useParams();
  const { group, error, notFound, reload } = useGroup(groupId);

  if (notFound) return <GroupNotFound />;
  if (error && !group) {
    return (
      <p className="loading form-error" role="alert">
        {error}
      </p>
    );
  }
  if (!group) return <p className="loading">Loading group…</p>;
  return <GroupView group={group} reload={reload} />;
}

function GroupView({ group, reload }: { group: GroupDetail; reload: () => Promise<void> }) {
  const user = useUser();
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <main className="page page-tight">
      <div className="stack" style={{ gap: 10 }}>
        <Link to="/" className="back-link">
          ← Your groups
        </Link>
        <div className="group-title-row">
          <div className="group-title">
            <h1>{group.name}</h1>
            <span className="group-meta">
              {group.currency} · {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
            </span>
          </div>
          <Link to={`/groups/${group.id}/expenses/new`} className="btn btn-primary">
            Add expense
          </Link>
        </div>
      </div>

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      <div className="group-layout">
        <section aria-labelledby="expenses-heading">
          <h2 id="expenses-heading" className="eyebrow" style={{ marginBottom: 12 }}>
            Expenses
          </h2>
          <div className="expense-list">
            {group.expenses.length === 0 && (
              <p className="empty">No expenses yet. Add the first one; balances update as soon as it's saved.</p>
            )}
            {group.expenses.map((expense) => (
              <ExpenseRow
                key={expense.id}
                group={group}
                expense={expense}
                currentUserId={user.id}
                onDeleted={reload}
                onError={setActionError}
              />
            ))}
          </div>
        </section>

        <aside className="side">
          <BalancesCard group={group} currentUserId={user.id} />
          {group.isCreator && group.inviteCode && (
            <section className="invite-panel" aria-labelledby="invite-heading">
              <div className="split-between">
                <h2 id="invite-heading" className="eyebrow">
                  Invite code
                </h2>
                <span style={{ fontSize: 12 }} className="muted">
                  Only you see this
                </span>
              </div>
              <div className="code-row" style={{ flexDirection: 'row' }}>
                <span className="code" data-testid="invite-code">
                  {group.inviteCode}
                </span>
                <CopyButton text={group.inviteCode} />
              </div>
            </section>
          )}
          {group.isCreator && <CurrencyPanel group={group} onChanged={reload} />}
        </aside>
      </div>
    </main>
  );
}

function ExpenseRow({
  group,
  expense,
  currentUserId,
  onDeleted,
  onError,
}: {
  group: GroupDetail;
  expense: Expense;
  currentUserId: string;
  onDeleted: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mine = expense.payerId === currentUserId;
  const payer = mine ? 'you' : memberName(group.members, expense.payerId, currentUserId);

  async function handleDelete() {
    setDeleting(true);
    onError(null);
    try {
      await api.deleteExpense(group.id, expense.id);
      await onDeleted();
    } catch (err) {
      onError(errorMessage(err));
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="expense-row" data-testid="expense-row">
      <span className="expense-date">{formatShortDate(expense.date)}</span>
      <span className="expense-main">
        <strong>{expense.description}</strong>
        <span>
          Paid by {payer} · shared by {participantSummary(group.members, expense.participantIds, currentUserId)}
        </span>
      </span>
      <span className="expense-amount">{formatAmount(expense.amountMinor)}</span>
      <span className="expense-actions">
        {!mine && <span>{memberName(group.members, expense.payerId, currentUserId)}'s entry</span>}
        {mine && !confirming && (
          <>
            <Link to={`/groups/${group.id}/expenses/${expense.id}/edit`} aria-label={`Edit ${expense.description}`}>
              Edit
            </Link>
            <button
              type="button"
              className="btn-link btn-danger-link"
              onClick={() => setConfirming(true)}
              aria-label={`Delete ${expense.description}`}
            >
              Delete
            </button>
          </>
        )}
        {mine && confirming && (
          <span className="confirm-inline">
            <button type="button" className="btn-link btn-danger-link" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Confirm delete'}
            </button>
            <button type="button" className="btn-link" onClick={() => setConfirming(false)} disabled={deleting}>
              Keep
            </button>
          </span>
        )}
      </span>
    </div>
  );
}

function BalancesCard({ group, currentUserId }: { group: GroupDetail; currentUserId: string }) {
  const maxAbs = Math.max(1, ...group.balances.map((b) => Math.abs(b.balance)));
  const sum = group.balances.reduce((total, b) => total + b.balance, 0);

  return (
    <section className="card" aria-labelledby="balances-heading">
      <h2 id="balances-heading" className="eyebrow">
        Net balances · {group.currency}
      </h2>
      <div className="balance-grid" data-testid="balances">
        {group.balances.map(({ memberId, balance }) => {
          // Bars scale to at most 120px, or the column width on narrow screens.
          const width = `calc(${(Math.abs(balance) / maxAbs).toFixed(4)} * min(120px, 100%))`;
          const tone = balanceTone(balance);
          const name = memberName(group.members, memberId, currentUserId);
          return (
            <div key={memberId} style={{ display: 'contents' }} data-testid={`balance-${name}`}>
              <span className="who" style={{ fontWeight: memberId === currentUserId ? 600 : 400 }}>
                {name}
              </span>
              <span>{tone === 'neg' && <span className="bar bar-neg" style={{ display: 'block', width }} />}</span>
              <span>{tone === 'pos' && <span className="bar bar-pos" style={{ display: 'block', width }} />}</span>
              <span className={`amount ${tone}`}>{formatSigned(balance)}</span>
            </div>
          );
        })}
      </div>
      <div className="sum-row">
        <span>Sum across members</span>
        <span className="mono" data-testid="balance-sum">
          {formatAmount(sum)}
        </span>
      </div>
      <p className="small-note">Positive: owed money. Negative: owes money. Paid minus your shares, in cents.</p>
    </section>
  );
}

function CurrencyPanel({ group, onChanged }: { group: GroupDetail; onChanged: () => Promise<void> }) {
  const [currency, setCurrency] = useState<CurrencyCode>(group.currency);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = group.currencyLocked;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.changeCurrency(group.id, currency);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="invite-panel" aria-labelledby="currency-heading">
      <h2 id="currency-heading" className="eyebrow">
        Group currency
      </h2>
      {locked ? (
        <p className="small-note">
          {group.currency} is fixed because expenses have been recorded. No conversion takes place.
        </p>
      ) : (
        <>
          <div className="currency-row">
            <label htmlFor="group-currency" className="visually-hidden">
              Currency
            </label>
            <select
              id="group-currency"
              className="input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSave}
              disabled={saving || currency === group.currency}
            >
              Save
            </button>
          </div>
          <p className="small-note">You can change it until the first expense is recorded.</p>
        </>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
