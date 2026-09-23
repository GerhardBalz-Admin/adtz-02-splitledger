"""Request and response models. JSON field names are camelCase, as in openapi.yaml."""

import datetime as dt
import re
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, StrictInt, StringConstraints, field_validator
from pydantic.alias_generators import to_camel

MAX_AMOUNT_MINOR = 99_999_999_999
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def iso_date_string(value: object) -> object:
    """Accept only "YYYY-MM-DD" strings, not timestamps or other date formats."""
    if not isinstance(value, str) or not ISO_DATE.match(value):
        raise ValueError("date must be a YYYY-MM-DD string")
    return value


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class CurrencyCode(StrEnum):
    CHF = "CHF"
    EUR = "EUR"
    USD = "USD"
    GBP = "GBP"


# Requests. Unknown fields such as a client-supplied payer are ignored.


class Credentials(CamelModel):
    email: Annotated[str, Field(max_length=254)]
    password: Annotated[str, Field(max_length=128)]


class GroupCreate(CamelModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    currency: CurrencyCode


class GroupUpdate(CamelModel):
    currency: CurrencyCode


class JoinRequest(CamelModel):
    invite_code: Annotated[str, Field(max_length=64)]


class ExpenseInput(CamelModel):
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    amount_minor: Annotated[StrictInt, Field(ge=1, le=MAX_AMOUNT_MINOR)]
    date: Annotated[dt.date, BeforeValidator(iso_date_string)]
    participant_ids: Annotated[list[str], Field(min_length=1)]

    @field_validator("participant_ids")
    @classmethod
    def distinct_participants(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise ValueError("participants must be distinct")
        return value


# Responses


class User(CamelModel):
    id: str
    email: str
    display_name: str


class Session(CamelModel):
    token: str
    user: User


class GroupSummary(CamelModel):
    id: str
    name: str
    currency: CurrencyCode
    is_creator: bool
    member_count: int
    expense_count: int
    my_balance: int


class JoinResult(CamelModel):
    group: GroupSummary
    already_member: bool


class Member(CamelModel):
    id: str
    display_name: str
    email: str
    joined_at: dt.datetime


class Expense(CamelModel):
    id: str
    description: str
    amount_minor: int
    date: dt.date
    payer_id: str
    participant_ids: list[str]
    created_at: dt.datetime


class MemberBalance(CamelModel):
    member_id: str
    balance: int


class GroupDetail(CamelModel):
    id: str
    name: str
    currency: CurrencyCode
    created_by: str
    is_creator: bool
    # Only set for the group's creator; omitted from the JSON otherwise.
    invite_code: str | None = None
    members: list[Member]
    expenses: list[Expense]
    balances: list[MemberBalance]


class ErrorResponse(BaseModel):
    detail: str
