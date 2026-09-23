"""Data kept in the SQL database survives an application restart.

Each test starts the app the way uvicorn does, through `create_app()` and its
start-up, against a SQLite file in the test's temporary directory. A restart is
a new app on the same file after the first one has stopped.
"""

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from splitledger_backend.database import Database, ExpenseParticipantRecord, SessionRecord
from splitledger_backend.main import create_app
from splitledger_backend.seed import DEMO_PASSWORD

from conftest import add_expense, auth, balances, create_group, join, sqlite_url


@pytest.fixture
def db_url(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> str:
    url = sqlite_url(tmp_path / "splitledger.sqlite3")
    monkeypatch.setenv("SPLITLEDGER_DATABASE_URL", url)
    monkeypatch.setenv("SPLITLEDGER_DEMO_DATA", "0")
    return url


@contextmanager
def running_app() -> Iterator[TestClient]:
    """The app from start-up to shutdown, as a server process would run it."""
    with TestClient(create_app()) as client:
        yield client


def sign_in(client: TestClient, email: str, password: str = "long-enough") -> dict[str, str]:
    response = client.post("/api/auth/signin", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return auth(response.json()["token"])


def signup(client: TestClient, email: str) -> dict[str, str]:
    response = client.post("/api/auth/signup", json={"email": email, "password": "long-enough"})
    assert response.status_code == 201, response.text
    return auth(response.json()["token"])


def test_importing_the_app_opens_no_database():
    from splitledger_backend import main

    assert not hasattr(main.app.state, "database")


def test_accounts_groups_and_expenses_survive_restart(db_url: str):
    with running_app() as client:
        ana, bo, cy = (
            signup(client, "ana@example.com"),
            signup(client, "bo@example.com"),
            signup(client, "cy@example.com"),
        )
        group = create_group(client, ana, name="Cabin", currency="EUR")
        join(client, bo, group["inviteCode"])
        join(client, cy, group["inviteCode"])
        create_group(client, bo, name="Bo's other group")
        members = [m["id"] for m in client.get(f"/api/groups/{group['id']}", headers=ana).json()["members"]]
        # 100.00 among three: the leftover cent goes to the first member in join order.
        kept = add_expense(client, cy, group["id"], amountMinor=10000, date="2026-03-04", participantIds=members[::-1])
        edited = add_expense(client, bo, group["id"], description="Fuel", amountMinor=3000, participantIds=members)
        response = client.patch(
            f"/api/groups/{group['id']}/expenses/{edited['id']}",
            json={
                "description": "Fuel, return",
                "amountMinor": 4001,
                "date": "2026-03-05",
                "participantIds": members[1:],
            },
            headers=bo,
        )
        assert response.status_code == 200, response.text
        before = client.get(f"/api/groups/{group['id']}", headers=ana).json()
        before_balances = balances(client, ana, group["id"])

    with running_app() as client:
        # Tokens issued before the restart still work, and passwords still verify.
        assert client.get("/api/auth/me", headers=ana).json()["email"] == "ana@example.com"
        assert sign_in(client, "cy@example.com")
        after = client.get(f"/api/groups/{group['id']}", headers=ana).json()
        assert after == before
        assert (
            balances(client, ana, group["id"])
            == before_balances
            == {
                members[0]: -3334,
                members[1]: 4001 - 3333 - 2001,
                members[2]: 10000 - 3333 - 2000,
            }
        )
        assert sum(before_balances.values()) == 0
        expenses = {e["id"]: e for e in after["expenses"]}
        assert expenses[kept["id"]]["participantIds"] == members
        assert expenses[kept["id"]]["date"] == "2026-03-04"
        assert expenses[edited["id"]]["description"] == "Fuel, return"
        assert expenses[edited["id"]]["participantIds"] == members[1:]
        assert datetime.fromisoformat(expenses[kept["id"]]["createdAt"]).utcoffset().total_seconds() == 0
        # Group lists, creator-only invite codes and permissions are unchanged.
        assert [g["name"] for g in client.get("/api/groups", headers=bo).json()] == ["Cabin", "Bo's other group"]
        assert [g["name"] for g in client.get("/api/groups", headers=cy).json()] == ["Cabin"]
        assert "inviteCode" not in client.get(f"/api/groups/{group['id']}", headers=bo).json()
        path = f"/api/groups/{group['id']}/expenses/{kept['id']}"
        assert client.delete(path, headers=ana).status_code == 403
        assert join(client, bo, group["inviteCode"])["alreadyMember"] is True
        assert len(client.get(f"/api/groups/{group['id']}", headers=ana).json()["members"]) == 3


def test_currency_stays_locked_after_restart_even_with_no_expenses(db_url: str):
    with running_app() as client:
        ana = signup(client, "ana@example.com")
        group = create_group(client, ana, currency="CHF")
        expense = add_expense(client, ana, group["id"], participantIds=[group["createdBy"]])
        assert client.delete(f"/api/groups/{group['id']}/expenses/{expense['id']}", headers=ana).status_code == 204

    with running_app() as client:
        detail = client.get(f"/api/groups/{group['id']}", headers=ana).json()
        assert detail["expenses"] == []
        assert detail["currencyLocked"] is True
        response = client.patch(f"/api/groups/{group['id']}", json={"currency": "EUR"}, headers=ana)
        assert response.status_code == 409


def test_unlocked_currency_change_survives_restart(db_url: str):
    with running_app() as client:
        ana = signup(client, "ana@example.com")
        group = create_group(client, ana, currency="CHF")
        assert client.patch(f"/api/groups/{group['id']}", json={"currency": "GBP"}, headers=ana).status_code == 200

    with running_app() as client:
        detail = client.get(f"/api/groups/{group['id']}", headers=ana).json()
        assert (detail["currency"], detail["currencyLocked"]) == ("GBP", False)


def test_sign_out_survives_restart(db_url: str):
    with running_app() as client:
        ana = signup(client, "ana@example.com")
        assert client.post("/api/auth/signout", headers=ana).status_code == 204

    with running_app() as client:
        assert client.get("/api/auth/me", headers=ana).status_code == 401


def test_demo_data_is_added_once_and_changes_to_it_are_kept(db_url: str, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SPLITLEDGER_DEMO_DATA", "1")
    with running_app() as client:
        dana = sign_in(client, "dana@example.com", DEMO_PASSWORD)
        add_expense(client, dana, "g_flat4b", description="Plants", amountMinor=300, participantIds=["u_dana"])

    with running_app() as client:
        dana = sign_in(client, "dana@example.com", DEMO_PASSWORD)
        flat = next(g for g in client.get("/api/groups", headers=dana).json() if g["id"] == "g_flat4b")
        assert flat["expenseCount"] == 5
        assert flat["memberCount"] == 4


def test_existing_database_is_not_seeded(db_url: str, monkeypatch: pytest.MonkeyPatch):
    with running_app() as client:
        signup(client, "ana@example.com")

    monkeypatch.setenv("SPLITLEDGER_DEMO_DATA", "1")
    with running_app() as client:
        response = client.post("/api/auth/signin", json={"email": "dana@example.com", "password": DEMO_PASSWORD})
        assert response.status_code == 401


def test_session_tokens_are_stored_only_as_digests(db_url: str):
    with running_app() as client:
        token = signup(client, "ana@example.com")["Authorization"].removeprefix("Bearer ")

    database = Database(db_url)
    with database.store() as store:
        stored = store.session.scalars(select(SessionRecord.token_hash)).all()
    database.dispose()
    assert len(stored) == 1
    assert token not in stored[0]


def test_deleting_an_expense_deletes_its_participants(db_url: str):
    with running_app() as client:
        ana = signup(client, "ana@example.com")
        group = create_group(client, ana)
        expense = add_expense(client, ana, group["id"], participantIds=[group["createdBy"]])
        assert client.delete(f"/api/groups/{group['id']}/expenses/{expense['id']}", headers=ana).status_code == 204

    database = Database(db_url)
    with database.store() as store:
        assert store.session.scalar(select(func.count()).select_from(ExpenseParticipantRecord)) == 0
    database.dispose()
