import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { GroupSummary } from '../api/types';
import { errorMessage } from '../lib/errors';
import { balanceTone, formatSigned } from '../lib/money';

export function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listGroups().then(setGroups, (err) => setError(errorMessage(err)));
  }, []);

  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">Your groups</h1>
          <p className="subtitle">Only groups you belong to appear here.</p>
        </div>
        <div className="actions">
          <Link to="/join" className="btn btn-outline">
            Join with code
          </Link>
          <Link to="/groups/new" className="btn btn-primary">
            New group
          </Link>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="group-table">
        <div className="group-row head" aria-hidden="true">
          <span>Group</span>
          <span>Currency</span>
          <span>Members</span>
          <span>Expenses</span>
          <span style={{ textAlign: 'right' }}>Your balance</span>
        </div>
        {groups === null && !error && <p className="empty">Loading groups…</p>}
        {groups?.length === 0 && (
          <p className="empty">
            You're not in any groups yet. Create one, or ask a group's creator for its invite code.
          </p>
        )}
        {groups?.map((group) => (
          <Link key={group.id} to={`/groups/${group.id}`} className="group-row">
            <span className="group-name">
              <strong>{group.name}</strong>
              <span>{group.isCreator ? 'You created this group' : 'Joined with a code'}</span>
            </span>
            <span className="num">
              <span className="cell-label">Currency</span>
              <span className="mono">{group.currency}</span>
            </span>
            <span className="num">
              <span className="cell-label">Members</span>
              {group.memberCount}
            </span>
            <span className="num">
              <span className="cell-label">Expenses</span>
              {group.expenseCount}
            </span>
            <span className={`balance ${balanceTone(group.myBalance)}`}>
              <span className="cell-label">Your balance</span>
              <span>
                {formatSigned(group.myBalance)}
                <span className="visually-hidden"> {group.currency}</span>
              </span>
            </span>
          </Link>
        ))}
      </div>

      <p className="footnote">
        Positive: the group owes you. Negative: you owe the group. SplitLedger does not suggest or record repayments.
      </p>
    </main>
  );
}
