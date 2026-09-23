import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { errorMessage } from '../lib/errors';

type Mode = 'signin' | 'signup';

export function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to={from} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="brand">SplitLedger</div>
        <div>
          <h1>
            Shared expenses.
            <br />
            One net balance each.
          </h1>
          <p>Record what you paid, choose who shares it, and see who is owed and who owes, per group.</p>
        </div>
        <div className="hero-ledger" aria-hidden="true">
          <div>
            <span>You</span>
            <span className="hero-pos">+60.00 CHF</span>
          </div>
          <div>
            <span>Anna</span>
            <span className="hero-neg">−30.00 CHF</span>
          </div>
          <div>
            <span>Ben</span>
            <span className="hero-neg">−30.00 CHF</span>
          </div>
        </div>
      </section>

      <main className="auth-main">
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="segmented" role="group" aria-label="Account action">
            <button type="button" aria-pressed={mode === 'signin'} onClick={() => switchMode('signin')}>
              Sign in
            </button>
            <button type="button" aria-pressed={mode === 'signup'} onClick={() => switchMode('signup')}>
              Create account
            </button>
          </div>
          <h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {mode === 'signup' && <span className="hint">At least 8 characters.</span>}
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          <p className="demo-note">
            {mode === 'signin'
              ? 'Create account uses the same two fields. No email verification in this version.'
              : 'No email verification in this version; you are signed in right away.'}
          </p>
          <p className="demo-note">
            Demo accounts seeded by the backend: <code>dana@example.com</code>, <code>anna@example.com</code>,{' '}
            <code>ben@example.com</code>, <code>chiara@example.com</code>, password <code>splitledger</code>.
          </p>
        </form>
      </main>
    </div>
  );
}
