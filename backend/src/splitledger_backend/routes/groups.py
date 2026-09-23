import re
import secrets

from fastapi import APIRouter, HTTPException, Response, status

from .. import schemas
from ..database import GroupRecord, MembershipRecord, MockDatabase, new_id
from ..deps import CurrentUser, Db, MemberGroup
from ..views import group_detail, group_summary

router = APIRouter(prefix="/groups", tags=["groups"])

# No 0/O or 1/I, so codes survive being read aloud or retyped.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def normalize_invite_code(code: str) -> str:
    """Upper-case and drop everything but letters and digits: " k7qm 4rx2" -> "K7QM4RX2"."""
    return re.sub(r"[^A-Z0-9]", "", code.upper())


def new_invite_code(db: MockDatabase) -> str:
    while True:
        raw = "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
        code = f"{raw[:4]}-{raw[4:]}"
        if db.get_group_by_invite_code(code) is None:
            return code


def find_group_by_code(db: MockDatabase, code: str) -> GroupRecord | None:
    normalized = normalize_invite_code(code)
    if len(normalized) != 8:
        return None
    return db.get_group_by_invite_code(f"{normalized[:4]}-{normalized[4:]}")


@router.get("", operation_id="listGroups")
def list_groups(db: Db, user: CurrentUser) -> list[schemas.GroupSummary]:
    return [group_summary(db, group, user.id) for group in db.list_groups_for_user(user.id)]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model_exclude_none=True,
    operation_id="createGroup",
)
def create_group(body: schemas.GroupCreate, db: Db, user: CurrentUser) -> schemas.GroupDetail:
    with db.transaction():
        group = db.add_group(
            GroupRecord(
                id=new_id(),
                name=body.name,
                currency=body.currency.value,
                created_by=user.id,
                invite_code=new_invite_code(db),
            )
        )
        db.add_membership(MembershipRecord(group_id=group.id, user_id=user.id))
        return group_detail(db, group, user.id)


@router.post(
    "/join",
    status_code=status.HTTP_201_CREATED,
    responses={200: {"model": schemas.JoinResult, "description": "Already a member; nothing changed."}},
    operation_id="joinGroup",
)
def join_group(body: schemas.JoinRequest, response: Response, db: Db, user: CurrentUser) -> schemas.JoinResult:
    with db.transaction():
        group = find_group_by_code(db, body.invite_code)
        if group is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "That code doesn't match any group. Check it and try again.")
        already_member = db.is_member(group.id, user.id)
        if already_member:
            response.status_code = status.HTTP_200_OK
        else:
            db.add_membership(MembershipRecord(group_id=group.id, user_id=user.id))
        return schemas.JoinResult(group=group_summary(db, group, user.id), already_member=already_member)


@router.get("/{groupId}", response_model_exclude_none=True, operation_id="getGroup")
def get_group(group: MemberGroup, db: Db, user: CurrentUser) -> schemas.GroupDetail:
    return group_detail(db, group, user.id)


@router.patch("/{groupId}", response_model_exclude_none=True, operation_id="changeCurrency")
def change_currency(body: schemas.GroupUpdate, group: MemberGroup, db: Db, user: CurrentUser) -> schemas.GroupDetail:
    if group.created_by != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the group creator can change the currency.")
    with db.transaction():
        if body.currency.value != group.currency:
            if group.has_recorded_expense:
                raise HTTPException(
                    status.HTTP_409_CONFLICT, "The currency cannot change once expenses have been recorded."
                )
            db.set_group_currency(group.id, body.currency.value)
        return group_detail(db, group, user.id)
