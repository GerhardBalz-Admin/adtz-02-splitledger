"""Shared FastAPI dependencies: the database and the signed-in user."""

from typing import Annotated

from fastapi import Depends, HTTPException, Path, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .database import GroupRecord, MockDatabase, UserRecord

bearer = HTTPBearer(auto_error=False)


def get_db(request: Request) -> MockDatabase:
    return request.app.state.db


Db = Annotated[MockDatabase, Depends(get_db)]
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]


def unauthorized(detail: str = "Please sign in.") -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"})


def get_current_user(db: Db, credentials: Credentials) -> UserRecord:
    user = db.get_session_user(credentials.credentials) if credentials else None
    if user is None:
        raise unauthorized()
    return user


CurrentUser = Annotated[UserRecord, Depends(get_current_user)]


def get_member_group(group_id: Annotated[str, Path(alias="groupId")], db: Db, user: CurrentUser) -> GroupRecord:
    """The group in the path, if the signed-in user belongs to it.

    Nonmembers get the same 404 as for a missing group, so a group's existence is not revealed.
    """
    group = db.get_group(group_id)
    if group is None or not db.is_member(group.id, user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found.")
    return group


MemberGroup = Annotated[GroupRecord, Depends(get_member_group)]
