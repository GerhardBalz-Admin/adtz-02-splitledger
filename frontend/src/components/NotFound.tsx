import { Link } from 'react-router-dom';

export function GroupNotFound() {
  return (
    <main className="page narrow">
      <Link to="/" className="back-link">
        ← Your groups
      </Link>
      <h1 className="page-title">Group not available</h1>
      <p className="muted" style={{ lineHeight: 1.5 }}>
        This group doesn't exist or you're not a member. To join a group, ask its creator for the invite code.
      </p>
    </main>
  );
}
