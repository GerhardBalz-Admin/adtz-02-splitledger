"""In-memory mock database.

It stores plain records and knows nothing about the business rules, which live
in the route handlers. Question 7 replaces it with SQLAlchemy and SQLite behind
the same methods. Data is lost when the process stops.
"""

import secrets
import threading
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from itertools import count


def utc_now() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return uuid.uuid4().hex


@dataclass
class UserRecord:
    id: str
    email: str
    password_hash: str
    created_at: datetime = field(default_factory=utc_now)


@dataclass
class GroupRecord:
    id: str
    name: str
    currency: str
    created_by: str
    invite_code: str
    created_at: datetime = field(default_factory=utc_now)
    has_recorded_expense: bool = False


@dataclass
class MembershipRecord:
    group_id: str
    user_id: str
    joined_at: datetime = field(default_factory=utc_now)


@dataclass
class ExpenseRecord:
    id: str
    group_id: str
    description: str
    amount_minor: int
    date: date
    payer_id: str
    # Stored in group join order.
    participant_ids: list[str]
    created_at: datetime = field(default_factory=utc_now)
    # Insertion order; breaks ties between expenses created in the same instant.
    seq: int = 0


class MockDatabase:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._users: dict[str, UserRecord] = {}
        self._sessions: dict[str, str] = {}
        self._groups: dict[str, GroupRecord] = {}
        self._memberships: list[MembershipRecord] = []  # in join order
        self._expenses: dict[str, ExpenseRecord] = {}
        self._seq = count(1)

    @contextmanager
    def transaction(self) -> Iterator["MockDatabase"]:
        """Hold the lock so a read-check-write sequence is atomic."""
        with self._lock:
            yield self

    # Users and sessions

    def add_user(self, user: UserRecord) -> UserRecord:
        with self._lock:
            self._users[user.id] = user
            return user

    def get_user(self, user_id: str) -> UserRecord | None:
        return self._users.get(user_id)

    def get_user_by_email(self, email: str) -> UserRecord | None:
        with self._lock:
            return next((u for u in self._users.values() if u.email == email), None)

    def create_session(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        with self._lock:
            self._sessions[token] = user_id
        return token

    def get_session_user(self, token: str) -> UserRecord | None:
        with self._lock:
            user_id = self._sessions.get(token)
            return self._users.get(user_id) if user_id else None

    def delete_session(self, token: str) -> None:
        with self._lock:
            self._sessions.pop(token, None)

    # Groups and memberships

    def add_group(self, group: GroupRecord) -> GroupRecord:
        with self._lock:
            self._groups[group.id] = group
            return group

    def get_group(self, group_id: str) -> GroupRecord | None:
        return self._groups.get(group_id)

    def get_group_by_invite_code(self, invite_code: str) -> GroupRecord | None:
        with self._lock:
            return next((g for g in self._groups.values() if g.invite_code == invite_code), None)

    def set_group_currency(self, group_id: str, currency: str) -> None:
        with self._lock:
            self._groups[group_id].currency = currency

    def add_membership(self, membership: MembershipRecord) -> MembershipRecord:
        with self._lock:
            self._memberships.append(membership)
            return membership

    def list_memberships(self, group_id: str) -> list[MembershipRecord]:
        """Members of a group in join order."""
        with self._lock:
            return [m for m in self._memberships if m.group_id == group_id]

    def is_member(self, group_id: str, user_id: str) -> bool:
        with self._lock:
            return any(m.group_id == group_id and m.user_id == user_id for m in self._memberships)

    def list_groups_for_user(self, user_id: str) -> list[GroupRecord]:
        """The user's groups in the order they joined them."""
        with self._lock:
            return [self._groups[m.group_id] for m in self._memberships if m.user_id == user_id]

    # Expenses

    def add_expense(self, expense: ExpenseRecord) -> ExpenseRecord:
        with self._lock:
            expense.seq = next(self._seq)
            self._expenses[expense.id] = expense
            self._groups[expense.group_id].has_recorded_expense = True
            return expense

    def get_expense(self, expense_id: str) -> ExpenseRecord | None:
        return self._expenses.get(expense_id)

    def list_expenses(self, group_id: str) -> list[ExpenseRecord]:
        """A group's expenses, newest date first, then newest created first."""
        with self._lock:
            expenses = [e for e in self._expenses.values() if e.group_id == group_id]
        return sorted(expenses, key=lambda e: (e.date, e.created_at, e.seq), reverse=True)

    def count_expenses(self, group_id: str) -> int:
        with self._lock:
            return sum(1 for e in self._expenses.values() if e.group_id == group_id)

    def update_expense(
        self, expense_id: str, *, description: str, amount_minor: int, date: date, participant_ids: list[str]
    ) -> ExpenseRecord:
        with self._lock:
            expense = self._expenses[expense_id]
            expense.description = description
            expense.amount_minor = amount_minor
            expense.date = date
            expense.participant_ids = participant_ids
            return expense

    def delete_expense(self, expense_id: str) -> None:
        with self._lock:
            self._expenses.pop(expense_id, None)
