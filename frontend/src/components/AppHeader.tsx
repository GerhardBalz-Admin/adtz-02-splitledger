import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/signin', { replace: true });
  }

  return (
    <header className="app-header">
      <Link to="/" className="brand">
        SplitLedger
      </Link>
      <div className="header-user">
        <span className="header-email">{user?.email}</span>
        <button type="button" className="btn-link" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}
