from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from splitledger_backend.database import Database
from splitledger_backend.main import create_app
from splitledger_backend.seed import DEMO_PASSWORD, seed_demo_data

Headers = dict[str, str]


@pytest.fixture(autouse=True)
def no_default_database(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Keep any app that opens the default database away from the developer's database file."""
    monkeypatch.setenv("SPLITLEDGER_DATABASE_URL", sqlite_url(tmp_path / "default.sqlite3"))


def sqlite_url(path: Path) -> str:
    return f"sqlite:///{path.as_posix()}"


@pytest.fixture
def database(tmp_path: Path) -> Iterator[Database]:
    """An empty SQLite database in a file of its own, deleted after the test."""
    database = Database(sqlite_url(tmp_path / "test.sqlite3"))
    yield database
    database.dispose()


@pytest.fixture
def client(database: Database) -> TestClient:
    """A client against an empty database."""
    return TestClient(create_app(database))


@pytest.fixture
def demo_client(database: Database) -> TestClient:
    """A client against the demo data (Dana, Anna, Ben, Chiara; Flat 4B and Ticino weekend)."""
    with database.store() as store, store.transaction():
        seed_demo_data(store)
    return TestClient(create_app(database))


def auth(token: str) -> Headers:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def signup(client: TestClient) -> Callable[[str], Headers]:
    """Signs up a new user on `client` and returns their auth headers."""

    def _signup(email: str, password: str = "long-enough") -> Headers:
        response = client.post("/api/auth/signup", json={"email": email, "password": password})
        assert response.status_code == 201, response.text
        return auth(response.json()["token"])

    return _signup


@pytest.fixture
def login(demo_client: TestClient) -> Callable[[str], Headers]:
    """Signs in a demo user by first name, e.g. login("dana")."""

    def _login(name: str) -> Headers:
        response = demo_client.post(
            "/api/auth/signin", json={"email": f"{name}@example.com", "password": DEMO_PASSWORD}
        )
        assert response.status_code == 200, response.text
        return auth(response.json()["token"])

    return _login


def create_group(client: TestClient, headers: Headers, name: str = "Trip", currency: str = "CHF") -> dict:
    response = client.post("/api/groups", json={"name": name, "currency": currency}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def join(client: TestClient, headers: Headers, code: str) -> dict:
    response = client.post("/api/groups/join", json={"inviteCode": code}, headers=headers)
    assert response.status_code in (200, 201), response.text
    return response.json()


def add_expense(client: TestClient, headers: Headers, group_id: str, **overrides) -> dict:
    body = {"description": "Groceries", "amountMinor": 9000, "date": "2026-09-21", "participantIds": []}
    body.update(overrides)
    response = client.post(f"/api/groups/{group_id}/expenses", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def balances(client: TestClient, headers: Headers, group_id: str) -> dict[str, int]:
    response = client.get(f"/api/groups/{group_id}", headers=headers)
    assert response.status_code == 200, response.text
    return {b["memberId"]: b["balance"] for b in response.json()["balances"]}
