import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { JoinResult } from '../api/types';
import { errorMessage } from '../lib/errors';

export function JoinGroupPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<JoinResult | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    if (!code.trim()) {
      setError('Enter the invite code.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      setResult(await api.joinGroup(code));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page narrow">
      <Link to="/" className="back-link">
        ← Your groups
      </Link>
      <h1 className="page-title">Join a group</h1>
      <p className="muted" style={{ lineHeight: 1.5 }}>
        Ask the person who created the group for its invite code.
      </p>
      <form className="field" style={{ gap: 8 }} onSubmit={handleSubmit} noValidate>
        <label htmlFor="code">Invite code</label>
        <div className="join-row">
          <input
            id="code"
            className="input"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXX-XXXX"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'code-err' : undefined}
          />
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Joining…' : 'Join'}
          </button>
        </div>
        {error && (
          <span id="code-err" className="error-text" role="alert">
            {error}
          </span>
        )}
      </form>

      {result && (
        <div className="notice-success" role="status">
          <strong>
            {result.alreadyMember ? `You're already in ${result.group.name}` : `You joined ${result.group.name}`}
          </strong>
          <span>
            {result.alreadyMember
              ? 'No duplicate membership was created.'
              : `Its expenses and balances are in ${result.group.currency}.`}{' '}
            <Link to={`/groups/${result.group.id}`}>Open group →</Link>
          </span>
        </div>
      )}
    </main>
  );
}
