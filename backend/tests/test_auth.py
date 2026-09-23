from fastapi.testclient import TestClient

from conftest import auth


def test_signup_returns_session_and_normalizes_email(client: TestClient):
    response = client.post("/api/auth/signup", json={"email": "  Erin@Example.com ", "password": "long-enough"})
    assert response.status_code == 201
    body = response.json()
    assert body["token"]
    assert body["user"]["email"] == "erin@example.com"
    assert body["user"]["displayName"] == "Erin"
    assert set(body["user"]) == {"id", "email", "displayName"}


def test_signup_rejects_duplicate_email(client: TestClient, signup):
    signup("erin@example.com")
    response = client.post("/api/auth/signup", json={"email": "ERIN@example.com", "password": "other-password"})
    assert response.status_code == 409
    assert isinstance(response.json()["detail"], str)


def test_signup_validates_email_and_password(client: TestClient):
    bad_email = client.post("/api/auth/signup", json={"email": "not-an-email", "password": "long-enough"})
    assert bad_email.status_code == 422
    assert isinstance(bad_email.json()["detail"], str)
    short = client.post("/api/auth/signup", json={"email": "erin@example.com", "password": "short"})
    assert short.status_code == 422
    missing = client.post("/api/auth/signup", json={"email": "erin@example.com"})
    assert missing.status_code == 422
    assert isinstance(missing.json()["detail"], str)


def test_signin_and_me(client: TestClient, signup):
    signup("erin@example.com", "long-enough")
    wrong = client.post("/api/auth/signin", json={"email": "erin@example.com", "password": "nope-nope"})
    assert wrong.status_code == 401
    unknown = client.post("/api/auth/signin", json={"email": "who@example.com", "password": "long-enough"})
    assert unknown.status_code == 401

    response = client.post("/api/auth/signin", json={"email": "Erin@example.com", "password": "long-enough"})
    assert response.status_code == 200
    me = client.get("/api/auth/me", headers=auth(response.json()["token"]))
    assert me.status_code == 200
    assert me.json()["email"] == "erin@example.com"


def test_me_requires_valid_token(client: TestClient):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers=auth("made-up")).status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Basic abc"}).status_code == 401


def test_signout_invalidates_token(client: TestClient, signup):
    headers = signup("erin@example.com")
    assert client.post("/api/auth/signout", headers=headers).status_code == 204
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    # Signing out again, or without a token, is harmless.
    assert client.post("/api/auth/signout", headers=headers).status_code == 204
    assert client.post("/api/auth/signout").status_code == 204


def test_passwords_are_not_stored_in_plain_text(client: TestClient, signup):
    signup("erin@example.com", "long-enough")
    db = client.app.state.db
    user = db.get_user_by_email("erin@example.com")
    assert user is not None
    assert "long-enough" not in user.password_hash
