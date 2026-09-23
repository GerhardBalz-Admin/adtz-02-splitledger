import re

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError

from .. import schemas
from ..database import UserRecord, new_id
from ..deps import Credentials, CurrentUser, Db, unauthorized
from ..security import hash_password, verify_password
from ..views import user_view

router = APIRouter(prefix="/auth", tags=["auth"])

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MIN_PASSWORD_LENGTH = 8


def normalize_email(email: str) -> str:
    return email.strip().lower()


@router.post("/signup", status_code=status.HTTP_201_CREATED, operation_id="signUp", openapi_extra={"security": []})
def sign_up(body: schemas.Credentials, db: Db) -> schemas.Session:
    email = normalize_email(body.email)
    if not EMAIL_PATTERN.match(email):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Enter a valid email address.")
    if len(body.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"Use a password with at least {MIN_PASSWORD_LENGTH} characters."
        )
    password_hash = hash_password(body.password)
    duplicate = HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists. Sign in instead.")
    try:
        with db.transaction():
            if db.get_user_by_email(email):
                raise duplicate
            user = db.add_user(UserRecord(id=new_id(), email=email, password_hash=password_hash))
            token = db.create_session(user.id)
    except IntegrityError:
        # Another request signed up with the same email at the same time.
        raise duplicate from None
    return schemas.Session(token=token, user=user_view(user))


@router.post("/signin", operation_id="signIn", openapi_extra={"security": []})
def sign_in(body: schemas.Credentials, db: Db) -> schemas.Session:
    user = db.get_user_by_email(normalize_email(body.email))
    if user is None or not verify_password(body.password, user.password_hash):
        raise unauthorized("Email or password is incorrect.")
    with db.transaction():
        token = db.create_session(user.id)
    return schemas.Session(token=token, user=user_view(user))


@router.post(
    "/signout",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id="signOut",
    openapi_extra={"security": []},
)
def sign_out(db: Db, credentials: Credentials) -> None:
    if credentials:
        with db.transaction():
            db.delete_session(credentials.credentials)


@router.get("/me", operation_id="currentUser")
def current_user(user: CurrentUser) -> schemas.User:
    return user_view(user)
