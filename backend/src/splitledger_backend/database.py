"""SQLAlchemy persistence.

`Database` owns the engine and creates the tables. `Store` wraps one SQLAlchemy
session per request and offers the same small set of methods the routes used
with the earlier in-memory mock. It knows nothing about the business rules,
which live in the route handlers.

Only portable SQLAlchemy types are used, so any database SQLAlchemy supports
works; SQLite is the local default.
"""

import hashlib
import secrets
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Engine,
    ForeignKey,
    Integer,
    String,
    TypeDecorator,
    UniqueConstraint,
    create_engine,
    event,
    func,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, selectinload, sessionmaker
from sqlalchemy.pool import StaticPool

DEFAULT_DATABASE_URL = "sqlite:///./splitledger.sqlite3"


def utc_now() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return uuid.uuid4().hex


def token_digest(token: str) -> str:
    """Session tokens are stored only as SHA-256 digests."""
    return hashlib.sha256(token.encode()).hexdigest()


class UTCDateTime(TypeDecorator):
    """Stores UTC as a naive timestamp and returns it timezone-aware.

    Not every database keeps a time zone (SQLite does not), so this behaves the same everywhere.
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("timestamps must be timezone-aware")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        return value.replace(tzinfo=UTC) if value is not None else None


class Base(DeclarativeBase):
    pass


class UserRecord(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)


class SessionRecord(Base):
    __tablename__ = "sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)


class GroupRecord(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    currency: Mapped[str] = mapped_column(String(3))
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    invite_code: Mapped[str] = mapped_column(String(9), unique=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)
    # Set by the first expense and never cleared, so the currency stays locked.
    has_recorded_expense: Mapped[bool] = mapped_column(Boolean, default=False)


class MembershipRecord(Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("group_id", "user_id"),)

    # Increases with every join, so it gives the group join order.
    seq: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    joined_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)


class ExpenseParticipantRecord(Base):
    __tablename__ = "expense_participants"

    expense_seq: Mapped[int] = mapped_column(ForeignKey("expenses.seq", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer)


class ExpenseRecord(Base):
    __tablename__ = "expenses"

    # Insertion order; breaks ties between expenses created in the same instant.
    seq: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id: Mapped[str] = mapped_column(String(32), unique=True)
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    description: Mapped[str] = mapped_column(String(120))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    date: Mapped[date] = mapped_column(Date)
    payer_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)
    participants: Mapped[list[ExpenseParticipantRecord]] = relationship(
        order_by=ExpenseParticipantRecord.position, cascade="all, delete-orphan", lazy="selectin"
    )

    def __init__(self, *, participant_ids: list[str] = (), **kwargs) -> None:
        super().__init__(**kwargs)
        self.participant_ids = list(participant_ids)

    @property
    def participant_ids(self) -> list[str]:
        """Stored in group join order."""
        return [p.user_id for p in self.participants]

    @participant_ids.setter
    def participant_ids(self, user_ids: list[str]) -> None:
        self.participants = [ExpenseParticipantRecord(user_id=u, position=i) for i, u in enumerate(user_ids)]


class Database:
    """An engine for `url` and the sessions that use it."""

    def __init__(self, url: str = DEFAULT_DATABASE_URL, *, create_tables: bool = True) -> None:
        options: dict = {}
        if url.startswith("sqlite"):
            # FastAPI runs sync endpoints in worker threads.
            options["connect_args"] = {"check_same_thread": False}
            if url in ("sqlite://", "sqlite:///:memory:"):
                # One shared connection, or each thread would see its own empty database.
                options["poolclass"] = StaticPool
        self.url = url
        self.engine: Engine = create_engine(url, **options)
        if self.engine.dialect.name == "sqlite":
            event.listen(self.engine, "connect", _enable_sqlite_foreign_keys)
        self._sessions = sessionmaker(self.engine, expire_on_commit=False)
        if create_tables:
            Base.metadata.create_all(self.engine)

    @contextmanager
    def store(self) -> Iterator["Store"]:
        with self._sessions() as session:
            yield Store(session)

    def dispose(self) -> None:
        self.engine.dispose()


def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


class Store:
    """Data access for one request, on one SQLAlchemy session."""

    def __init__(self, session: Session) -> None:
        self.session = session

    @contextmanager
    def transaction(self) -> Iterator["Store"]:
        """Commit the changes made inside the block, or roll them all back on an error."""
        try:
            yield self
            self.session.commit()
        except BaseException:
            self.session.rollback()
            raise

    def is_empty(self) -> bool:
        return self.session.scalar(select(func.count()).select_from(UserRecord)) == 0

    # Users and sessions

    def add_user(self, user: UserRecord) -> UserRecord:
        self.session.add(user)
        self.session.flush()
        return user

    def get_user(self, user_id: str) -> UserRecord | None:
        return self.session.get(UserRecord, user_id)

    def get_user_by_email(self, email: str) -> UserRecord | None:
        return self.session.scalar(select(UserRecord).where(UserRecord.email == email))

    def create_session(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        self.session.add(SessionRecord(token_hash=token_digest(token), user_id=user_id))
        self.session.flush()
        return token

    def get_session_user(self, token: str) -> UserRecord | None:
        record = self.session.get(SessionRecord, token_digest(token))
        return self.get_user(record.user_id) if record else None

    def delete_session(self, token: str) -> None:
        record = self.session.get(SessionRecord, token_digest(token))
        if record is not None:
            self.session.delete(record)
            self.session.flush()

    # Groups and memberships

    def add_group(self, group: GroupRecord) -> GroupRecord:
        self.session.add(group)
        self.session.flush()
        return group

    def get_group(self, group_id: str) -> GroupRecord | None:
        return self.session.get(GroupRecord, group_id)

    def get_group_by_invite_code(self, invite_code: str) -> GroupRecord | None:
        return self.session.scalar(select(GroupRecord).where(GroupRecord.invite_code == invite_code))

    def set_group_currency(self, group_id: str, currency: str) -> None:
        self.session.get_one(GroupRecord, group_id).currency = currency
        self.session.flush()

    def add_membership(self, membership: MembershipRecord) -> MembershipRecord:
        self.session.add(membership)
        self.session.flush()
        return membership

    def list_memberships(self, group_id: str) -> list[MembershipRecord]:
        """Members of a group in join order."""
        query = select(MembershipRecord).where(MembershipRecord.group_id == group_id).order_by(MembershipRecord.seq)
        return list(self.session.scalars(query))

    def is_member(self, group_id: str, user_id: str) -> bool:
        query = select(MembershipRecord.seq).where(
            MembershipRecord.group_id == group_id, MembershipRecord.user_id == user_id
        )
        return self.session.scalar(query) is not None

    def list_groups_for_user(self, user_id: str) -> list[GroupRecord]:
        """The user's groups in the order they joined them."""
        query = (
            select(GroupRecord)
            .join(MembershipRecord, MembershipRecord.group_id == GroupRecord.id)
            .where(MembershipRecord.user_id == user_id)
            .order_by(MembershipRecord.seq)
        )
        return list(self.session.scalars(query))

    # Expenses

    def add_expense(self, expense: ExpenseRecord) -> ExpenseRecord:
        self.session.add(expense)
        self.session.get_one(GroupRecord, expense.group_id).has_recorded_expense = True
        self.session.flush()
        return expense

    def get_expense(self, expense_id: str) -> ExpenseRecord | None:
        return self.session.scalar(select(ExpenseRecord).where(ExpenseRecord.id == expense_id))

    def list_expenses(self, group_id: str) -> list[ExpenseRecord]:
        """A group's expenses, newest date first, then newest created first."""
        query = (
            select(ExpenseRecord)
            .where(ExpenseRecord.group_id == group_id)
            .options(selectinload(ExpenseRecord.participants))
            .order_by(ExpenseRecord.date.desc(), ExpenseRecord.created_at.desc(), ExpenseRecord.seq.desc())
        )
        return list(self.session.scalars(query))

    def count_expenses(self, group_id: str) -> int:
        query = select(func.count()).select_from(ExpenseRecord).where(ExpenseRecord.group_id == group_id)
        return self.session.scalar(query) or 0

    def update_expense(
        self, expense_id: str, *, description: str, amount_minor: int, date: date, participant_ids: list[str]
    ) -> ExpenseRecord:
        expense = self.get_expense(expense_id)
        assert expense is not None
        expense.description = description
        expense.amount_minor = amount_minor
        expense.date = date
        if participant_ids != expense.participant_ids:
            # Remove the old rows first so a kept participant is not inserted twice.
            expense.participants.clear()
            self.session.flush()
            expense.participant_ids = participant_ids
        self.session.flush()
        return expense

    def delete_expense(self, expense_id: str) -> None:
        expense = self.get_expense(expense_id)
        if expense is not None:
            self.session.delete(expense)
            self.session.flush()
