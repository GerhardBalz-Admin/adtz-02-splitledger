from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Response, status

from .. import schemas
from ..database import ExpenseRecord, GroupRecord, Store, UserRecord, new_id
from ..deps import CurrentUser, Db, MemberGroup
from ..views import expense_view

ExpenseId = Annotated[str, Path(alias="expenseId")]

router = APIRouter(prefix="/groups/{groupId}/expenses", tags=["expenses"])


def participants_in_join_order(db: Store, group_id: str, participant_ids: list[str]) -> list[str]:
    member_order = [m.user_id for m in db.list_memberships(group_id)]
    selected = set(participant_ids)
    if not selected <= set(member_order):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Every selected participant must be a member of this group."
        )
    return [member_id for member_id in member_order if member_id in selected]


def own_expense(db: Store, group: GroupRecord, expense_id: str, user: UserRecord) -> ExpenseRecord:
    expense = db.get_expense(expense_id)
    if expense is None or expense.group_id != group.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Expense not found.")
    if expense.payer_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the member who entered this expense can change it.")
    return expense


@router.post("", status_code=status.HTTP_201_CREATED, operation_id="createExpense")
def create_expense(body: schemas.ExpenseInput, group: MemberGroup, db: Db, user: CurrentUser) -> schemas.Expense:
    with db.transaction():
        expense = db.add_expense(
            ExpenseRecord(
                id=new_id(),
                group_id=group.id,
                description=body.description,
                amount_minor=body.amount_minor,
                date=body.date,
                # The payer is always the authenticated user.
                payer_id=user.id,
                participant_ids=participants_in_join_order(db, group.id, body.participant_ids),
            )
        )
        return expense_view(expense)


@router.patch("/{expenseId}", operation_id="updateExpense")
def update_expense(
    expense_id: ExpenseId, body: schemas.ExpenseInput, group: MemberGroup, db: Db, user: CurrentUser
) -> schemas.Expense:
    with db.transaction():
        own_expense(db, group, expense_id, user)
        expense = db.update_expense(
            expense_id,
            description=body.description,
            amount_minor=body.amount_minor,
            date=body.date,
            participant_ids=participants_in_join_order(db, group.id, body.participant_ids),
        )
        return expense_view(expense)


@router.delete(
    "/{expenseId}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, operation_id="deleteExpense"
)
def delete_expense(expense_id: ExpenseId, group: MemberGroup, db: Db, user: CurrentUser) -> None:
    with db.transaction():
        own_expense(db, group, expense_id, user)
        db.delete_expense(expense_id)
