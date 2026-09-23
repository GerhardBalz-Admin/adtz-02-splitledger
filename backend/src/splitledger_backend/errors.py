"""Turns request validation errors into the contract's `{"detail": "<message>"}` shape."""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

FIELD_MESSAGES = {
    "email": "Enter an email address.",
    "password": "Enter a password of up to 128 characters.",
    "name": "Enter a group name of up to 60 characters.",
    "currency": "Choose one of the supported currencies: CHF, EUR, USD or GBP.",
    "inviteCode": "Enter the invite code.",
    "description": "Enter a description of up to 120 characters.",
    "amountMinor": "Enter an amount greater than zero, as a whole number of minor units (cents).",
    "date": "Enter a valid date as YYYY-MM-DD.",
    "participantIds": "Select at least one member of this group, each only once.",
}


def describe(error: dict) -> str:
    fields = [part for part in error.get("loc", ()) if isinstance(part, str) and part != "body"]
    for field in reversed(fields):
        if field in FIELD_MESSAGES:
            return FIELD_MESSAGES[field]
    if not fields:
        return "Send a valid JSON request body."
    return f"Invalid value for {'.'.join(fields)}: {error.get('msg', 'invalid')}."


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = exc.errors()
        detail = describe(errors[0]) if errors else "Invalid request."
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content={"detail": detail})
