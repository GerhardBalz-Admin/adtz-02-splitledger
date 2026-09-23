import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Expense, GroupDetail } from '../api/types';
import { useUser } from '../auth';
import { GroupNotFound } from '../components/NotFound';
import { isIsoDate, todayIso } from '../lib/dates';
import { errorMessage } from '../lib/errors';
import { formatAmount, formatSigned, parseAmount } from '../lib/money';
import { memberName } from '../lib/names';
import { splitEqually } from '../lib/split';
import { useGroup } from '../lib/useGroup';

export function ExpenseFormPage() {
  const { groupId, expenseId } = useParams();
  const { group, error, notFound } = useGroup(groupId);
  const user = useUser();

  if (notFound) return <GroupNotFound />;
  if (error && !group) {
    return (
      <p className="loading form-error" role="alert">
        {error}
      </p>
    );
  }
  if (!group) return <p className="loading">Loading…</p>;

  const expense = expenseId ? group.expenses.find((e) => e.id === expenseId) : undefined;
  if (expenseId && (!expense || expense.payerId !== user.id)) {
    return (
      <main className="page narrow">
        <Link to={`/groups/${group.id}`} className="back-link">
          ← {group.name}
        </Link>
        <h1 className="page-title">Can't edit this expense</h1>
        <p className="muted" style={{ lineHeight: 1.5 }}>
          {expense
            ? 'Only the member who entered an expense can edit or delete it.'
            : 'This expense no longer exists.'}
        </p>
      </main>
    );
  }

  return <ExpenseForm key={expense?.id ?? 'new'} group={group} expense={expense} />;
}

interface FieldErrors {
  description?: string;
  amount?: string;
  date?: string;
  participants?: string;
}

/** The signed-in user's balance effect of one expense: paid amount minus own share. */
function effectOnPayer(amountMinor: number, participantIds: string[], payerId: string): number {
  const share = splitEqually(amountMinor, participantIds).find((s) => s.memberId === payerId)?.amount ?? 0;
  return amountMinor - share;
}

function ExpenseForm({ group, expense }: { group: GroupDetail; expense?: Expense }) {
  const user = useUser();
  const navigate = useNavigate();
  const editing = expense !== undefined;
  const groupUrl = `/groups/${group.id}`;

  const [description, setDescription] = useState(expense?.description ?? '');
  const [amountText, setAmountText] = useState(expense ? formatAmount(expense.amountMinor) : '');
  const [date, setDate] = useState(expense?.date ?? todayIso());
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(expense?.participantIds ?? group.members.map((m) => m.id)),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Participants always in group join order, which also decides who gets leftover cents.
  const participantIds = group.members.filter((m) => selected.has(m.id)).map((m) => m.id);
  const amountMinor = parseAmount(amountText);
  const validAmount = amountMinor !== null && amountMinor > 0 ? amountMinor : null;

  let preview: { shares: ReturnType<typeof splitEqually>; change: number; remainder: number } | null = null;
  if (validAmount !== null && participantIds.length > 0) {
    const oldEffect = expense ? effectOnPayer(expense.amountMinor, expense.participantIds, user.id) : 0;
    preview = {
      shares: splitEqually(validAmount, participantIds),
      change: effectOnPayer(validAmount, participantIds, user.id) - oldEffect,
      remainder: validAmount % participantIds.length,
    };
  }

  function toggle(memberId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
    setErrors((e) => ({ ...e, participants: undefined }));
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!description.trim()) next.description = 'Enter a description.';
    if (amountMinor === null) next.amount = 'Enter an amount like 12.50.';
    else if (amountMinor <= 0) next.amount = 'Enter an amount greater than zero.';
    if (!isIsoDate(date)) next.date = 'Enter a valid date.';
    if (participantIds.length === 0) next.participants = 'Select at least one member.';
    return next;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0 || amountMinor === null) return;
    setSaving(true);
    const input = { description: description.trim(), amountMinor, date, participantIds };
    try {
      if (expense) await api.updateExpense(group.id, expense.id, input);
      else await api.createExpense(group.id, input);
      navigate(groupUrl);
    } catch (err) {
      setFormError(errorMessage(err));
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!expense) return;
    setSaving(true);
    try {
      await api.deleteExpense(group.id, expense.id);
      navigate(groupUrl);
    } catch (err) {
      setFormError(errorMessage(err));
      setSaving(false);
      setConfirmDelete(false);
    }
  }

  return (
    <main className="page page-tight form-layout">
      <form className="expense-form" onSubmit={handleSubmit} noValidate>
        <Link to={groupUrl} className="back-link">
          ← {group.name}
        </Link>
        <h1 className="page-title">{editing ? 'Edit expense' : 'Add expense'}</h1>

        <div className="field">
          <label htmlFor="desc">Description</label>
          <input
            id="desc"
            className="input"
            type="text"
            maxLength={120}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setErrors((x) => ({ ...x, description: undefined }));
            }}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? 'desc-err' : undefined}
          />
          {errors.description && (
            <span id="desc-err" className="error-text">
              {errors.description}
            </span>
          )}
        </div>

        <div className="pair">
          <div className="field">
            <label htmlFor="amt">Amount ({group.currency})</label>
            <input
              id="amt"
              className="input amount-input"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amountText}
              onChange={(e) => {
                setAmountText(e.target.value);
                setErrors((x) => ({ ...x, amount: undefined }));
              }}
              aria-invalid={errors.amount ? true : undefined}
              aria-describedby={errors.amount ? 'amt-err' : undefined}
            />
            {errors.amount && (
              <span id="amt-err" className="error-text">
                {errors.amount}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="date">Date</label>
            <input
              id="date"
              className="input"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setErrors((x) => ({ ...x, date: undefined }));
              }}
              aria-invalid={errors.date ? true : undefined}
              aria-describedby="date-hint"
            />
            {errors.date ? (
              <span id="date-hint" className="error-text">
                {errors.date}
              </span>
            ) : (
              <span id="date-hint" className="hint">
                Today by default; pick an earlier day if needed.
              </span>
            )}
          </div>
        </div>

        <div className="payer-note">
          <strong>Paid by you</strong>
          <span className="muted">· the signed-in member is always the payer</span>
        </div>

        <fieldset className="members" aria-describedby={errors.participants ? 'members-err' : undefined}>
          <legend className="legend">Shared by (at least one)</legend>
          <div className="member-grid">
            {group.members.map((member) => {
              const checked = selected.has(member.id);
              return (
                <label key={member.id} className={`member-option${checked ? ' checked' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(member.id)} />
                  {memberName(group.members, member.id, user.id)}
                </label>
              );
            })}
          </div>
          <div className="select-links">
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setSelected(new Set(group.members.map((m) => m.id)));
                setErrors((x) => ({ ...x, participants: undefined }));
              }}
            >
              Select everyone
            </button>
            <button
              type="button"
              className="btn-link"
              onClick={() => setSelected(new Set(group.members.filter((m) => m.id !== user.id).map((m) => m.id)))}
            >
              Everyone but me
            </button>
          </div>
          {errors.participants && (
            <span id="members-err" className="error-text">
              {errors.participants}
            </span>
          )}
        </fieldset>

        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Save expense'}
          </button>
          <Link to={groupUrl} className="btn btn-link" style={{ fontSize: 15 }}>
            Cancel
          </Link>
          {editing && <span className="spacer" />}
          {editing && !confirmDelete && (
            <button
              type="button"
              className="btn-link btn-danger-link"
              style={{ fontSize: 15 }}
              onClick={() => setConfirmDelete(true)}
            >
              Delete expense
            </button>
          )}
          {editing && confirmDelete && (
            <span className="confirm-inline">
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                Confirm delete
              </button>
              <button type="button" className="btn-link" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
            </span>
          )}
        </div>
      </form>

      <aside className="card preview" aria-labelledby="preview-heading" aria-live="polite">
        <h2 id="preview-heading" className="eyebrow">
          Split preview
        </h2>
        {preview ? (
          <>
            <p className="mono" style={{ fontSize: 15 }} data-testid="split-summary">
              {formatAmount(validAmount!)} ÷ {participantIds.length} = {formatAmount(preview.shares.at(-1)!.amount)}
              {preview.remainder > 0 && ` r ${formatAmount(preview.remainder)}`}
            </p>
            <div className="preview-rows">
              {preview.shares.map((share) => (
                <div key={share.memberId} className="preview-row">
                  <span>
                    {memberName(group.members, share.memberId, user.id)}{' '}
                    {share.extraCents > 0 && <small>+1 cent</small>}
                  </span>
                  <span className="mono">{formatAmount(share.amount)}</span>
                </div>
              ))}
              <div className="preview-row total">
                <span>Total</span>
                <span className="mono">{formatAmount(validAmount!)}</span>
              </div>
            </div>
            <p className="small-note">
              Leftover cents go to selected members in join order, so every cent is kept. After saving, your balance
              changes by <span className="mono">{formatSigned(preview.change)}</span>.
            </p>
          </>
        ) : (
          <p className="small-note">Enter an amount and select at least one member to see each share.</p>
        )}
      </aside>
    </main>
  );
}
