import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { GroupDetail } from '../api/types';
import { CopyButton } from '../components/CopyButton';
import { errorMessage } from '../lib/errors';
import { CURRENCIES, type CurrencyCode } from '../lib/money';

export function CreateGroupPage() {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('CHF');
  const [error, setError] = useState<string | null>(null);
  const [nameMissing, setNameMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<GroupDetail | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setNameMissing(true);
      setError('Enter a group name.');
      return;
    }
    setNameMissing(false);
    setError(null);
    setSubmitting(true);
    try {
      setCreated(await api.createGroup(name, currency));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page two-col">
      <form className="stack" onSubmit={handleSubmit} noValidate>
        <Link to="/" className="back-link">
          ← Your groups
        </Link>
        <h1 className="page-title">New group</h1>
        <div className="field">
          <label htmlFor="group-name">Group name</label>
          <input
            id="group-name"
            className="input"
            type="text"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={nameMissing || undefined}
            disabled={created !== null}
          />
        </div>
        <div className="field">
          <label htmlFor="currency">Currency</label>
          <select
            id="currency"
            className="input"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            disabled={created !== null}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <span className="hint">Every expense in this group uses this currency. It can't change once expenses exist.</span>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {created ? (
          <button
            type="button"
            className="btn btn-outline btn-lg"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => {
              setCreated(null);
              setName('');
            }}
          >
            Create another group
          </button>
        ) : (
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ alignSelf: 'flex-start' }}
            disabled={submitting}
          >
            {submitting ? 'Creating…' : 'Create group'}
          </button>
        )}
      </form>

      {created?.inviteCode && (
        <section className="card invite-card" aria-live="polite">
          <span className="success-label">Group created</span>
          <h2>Invite people to {created.name}</h2>
          <p>
            Share this code yourself, by chat or in person. They sign in and enter it under Join with code. Only you can
            see it.
          </p>
          <div className="code-row">
            <span className="code-box" data-testid="invite-code">
              {created.inviteCode}
            </span>
            <CopyButton text={created.inviteCode} label="Copy code" />
          </div>
          <Link to={`/groups/${created.id}`} style={{ alignSelf: 'flex-start', fontSize: 15, fontWeight: 600 }}>
            Open group →
          </Link>
        </section>
      )}
    </main>
  );
}
