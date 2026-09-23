"""Builds response models from database records."""

from . import schemas
from .database import ExpenseRecord, GroupRecord, Store, UserRecord
from .money import ExpenseShareInput, compute_balances


def display_name(email: str) -> str:
    local = email.split("@", 1)[0]
    return local[:1].upper() + local[1:]


def user_view(user: UserRecord) -> schemas.User:
    return schemas.User(id=user.id, email=user.email, display_name=display_name(user.email))


def expense_view(expense: ExpenseRecord) -> schemas.Expense:
    return schemas.Expense(
        id=expense.id,
        description=expense.description,
        amount_minor=expense.amount_minor,
        date=expense.date,
        payer_id=expense.payer_id,
        participant_ids=list(expense.participant_ids),
        created_at=expense.created_at,
    )


def group_balances(db: Store, group_id: str) -> dict[str, int]:
    member_ids = [m.user_id for m in db.list_memberships(group_id)]
    shares = [
        ExpenseShareInput(payer_id=e.payer_id, amount_minor=e.amount_minor, participant_ids=e.participant_ids)
        for e in db.list_expenses(group_id)
    ]
    return compute_balances(member_ids, shares)


def group_summary(db: Store, group: GroupRecord, user_id: str) -> schemas.GroupSummary:
    return schemas.GroupSummary(
        id=group.id,
        name=group.name,
        currency=group.currency,
        is_creator=group.created_by == user_id,
        member_count=len(db.list_memberships(group.id)),
        expense_count=db.count_expenses(group.id),
        my_balance=group_balances(db, group.id).get(user_id, 0),
    )


def group_detail(db: Store, group: GroupRecord, user_id: str) -> schemas.GroupDetail:
    memberships = db.list_memberships(group.id)
    balances = group_balances(db, group.id)
    members = []
    for membership in memberships:
        user = db.get_user(membership.user_id)
        assert user is not None
        members.append(
            schemas.Member(
                id=user.id, display_name=display_name(user.email), email=user.email, joined_at=membership.joined_at
            )
        )
    is_creator = group.created_by == user_id
    return schemas.GroupDetail(
        id=group.id,
        name=group.name,
        currency=group.currency,
        created_by=group.created_by,
        is_creator=is_creator,
        currency_locked=group.has_recorded_expense,
        invite_code=group.invite_code if is_creator else None,
        members=members,
        expenses=[expense_view(e) for e in db.list_expenses(group.id)],
        balances=[schemas.MemberBalance(member_id=m.id, balance=balances.get(m.id, 0)) for m in members],
    )
