"""Demo data, identical to the frontend mock: Flat 4B balances +81.66, +16.67, −48.33, −50.00."""

from datetime import UTC, date, datetime
from functools import cache

from .database import ExpenseRecord, GroupRecord, MembershipRecord, MockDatabase, UserRecord
from .security import hash_password

DEMO_PASSWORD = "splitledger"


@cache
def _demo_password_hash() -> str:
    # Hashed once and shared by the demo accounts to keep start-up and tests fast.
    return hash_password(DEMO_PASSWORD)


def _at(timestamp: str) -> datetime:
    return datetime.fromisoformat(timestamp).replace(tzinfo=UTC)


def seed_demo_data(db: MockDatabase) -> None:
    for name in ("dana", "anna", "ben", "chiara"):
        db.add_user(
            UserRecord(
                id=f"u_{name}",
                email=f"{name}@example.com",
                password_hash=_demo_password_hash(),
                created_at=_at("2026-08-28T08:00:00"),
            )
        )

    db.add_group(GroupRecord("g_flat4b", "Flat 4B", "CHF", "u_dana", "K7QM-4RX2", _at("2026-08-28T09:00:00")))
    db.add_group(GroupRecord("g_ticino", "Ticino weekend", "EUR", "u_ben", "T3NW-8HPD", _at("2026-09-02T12:00:00")))

    for group_id, user_id, joined in (
        ("g_flat4b", "u_dana", "2026-08-28T09:00:00"),
        ("g_flat4b", "u_anna", "2026-08-28T10:00:00"),
        ("g_flat4b", "u_ben", "2026-08-29T08:00:00"),
        ("g_flat4b", "u_chiara", "2026-08-30T18:00:00"),
        ("g_ticino", "u_ben", "2026-09-02T12:00:00"),
        ("g_ticino", "u_dana", "2026-09-02T13:00:00"),
        ("g_ticino", "u_chiara", "2026-09-03T07:30:00"),
    ):
        db.add_membership(MembershipRecord(group_id, user_id, _at(joined)))

    flat = ["u_dana", "u_anna", "u_ben", "u_chiara"]
    ticino = ["u_ben", "u_dana", "u_chiara"]
    for expense_id, group_id, description, amount, day, payer, participants in (
        ("e_groceries", "g_flat4b", "Groceries", 9000, "2026-09-21", "u_dana", flat[:3]),
        ("e_cleaning", "g_flat4b", "Cleaning supplies", 1000, "2026-09-18", "u_ben", flat[:3]),
        ("e_concert", "g_flat4b", "Concert tickets", 5000, "2026-09-12", "u_dana", ["u_anna", "u_chiara"]),
        ("e_internet", "g_flat4b", "Internet, September", 10000, "2026-09-01", "u_anna", flat),
        ("e_train", "g_ticino", "Train tickets", 13680, "2026-09-05", "u_ben", ticino),
        ("e_dinner", "g_ticino", "Dinner in Locarno", 9800, "2026-09-06", "u_chiara", ticino),
    ):
        db.add_expense(
            ExpenseRecord(
                id=expense_id,
                group_id=group_id,
                description=description,
                amount_minor=amount,
                date=date.fromisoformat(day),
                payer_id=payer,
                participant_ids=participants,
                created_at=_at(f"{day}T12:00:00"),
            )
        )
