import re

from fastapi.testclient import TestClient

from conftest import add_expense, create_group, join


def test_groups_require_authentication(client: TestClient):
    assert client.get("/api/groups").status_code == 401
    assert client.post("/api/groups", json={"name": "X", "currency": "CHF"}).status_code == 401
    assert client.post("/api/groups/join", json={"inviteCode": "ABCD-EFGH"}).status_code == 401


def test_create_group_makes_creator_first_member(client: TestClient, signup):
    dana = signup("dana@example.com")
    group = create_group(client, dana, name="  Flat 4B ", currency="EUR")
    assert group["name"] == "Flat 4B"
    assert group["currency"] == "EUR"
    assert group["isCreator"] is True
    assert re.fullmatch(r"[A-Z0-9]{4}-[A-Z0-9]{4}", group["inviteCode"])
    assert [m["email"] for m in group["members"]] == ["dana@example.com"]
    assert group["createdBy"] == group["members"][0]["id"]
    assert group["expenses"] == []
    assert group["balances"] == [{"memberId": group["createdBy"], "balance": 0}]


def test_create_group_validation(client: TestClient, signup):
    dana = signup("dana@example.com")
    for body in (
        {"name": "   ", "currency": "CHF"},
        {"name": "x" * 61, "currency": "CHF"},
        {"name": "Trip", "currency": "JPY"},
        {"name": "Trip"},
    ):
        response = client.post("/api/groups", json=body, headers=dana)
        assert response.status_code == 422, body
        assert isinstance(response.json()["detail"], str)


def test_user_sees_only_their_groups(client: TestClient, signup):
    dana = signup("dana@example.com")
    erin = signup("erin@example.com")
    create_group(client, dana, name="Flat")
    create_group(client, dana, name="Trip")
    create_group(client, erin, name="Erin's")

    dana_groups = client.get("/api/groups", headers=dana).json()
    assert [g["name"] for g in dana_groups] == ["Flat", "Trip"]
    assert dana_groups[0] == {
        "id": dana_groups[0]["id"],
        "name": "Flat",
        "currency": "CHF",
        "isCreator": True,
        "memberCount": 1,
        "expenseCount": 0,
        "myBalance": 0,
    }
    assert [g["name"] for g in client.get("/api/groups", headers=erin).json()] == ["Erin's"]


def test_join_with_code(client: TestClient, signup):
    dana = signup("dana@example.com")
    erin = signup("erin@example.com")
    group = create_group(client, dana)

    result = client.post("/api/groups/join", json={"inviteCode": group["inviteCode"]}, headers=erin)
    assert result.status_code == 201
    assert result.json()["alreadyMember"] is False
    assert result.json()["group"]["isCreator"] is False
    assert result.json()["group"]["memberCount"] == 2

    # Case, spaces and hyphens are ignored; re-joining creates no duplicate.
    messy = " " + group["inviteCode"].lower().replace("-", " ") + " "
    again = client.post("/api/groups/join", json={"inviteCode": messy}, headers=erin)
    assert again.status_code == 200
    assert again.json()["alreadyMember"] is True
    detail = client.get(f"/api/groups/{group['id']}", headers=erin).json()
    assert [m["email"] for m in detail["members"]] == ["dana@example.com", "erin@example.com"]

    # The creator re-entering their own code is also a no-op.
    assert join(client, dana, group["inviteCode"])["alreadyMember"] is True


def test_invalid_code_grants_no_access(client: TestClient, signup):
    dana = signup("dana@example.com")
    erin = signup("erin@example.com")
    create_group(client, dana)
    response = client.post("/api/groups/join", json={"inviteCode": "ZZZZ-9999"}, headers=erin)
    assert response.status_code == 404
    assert isinstance(response.json()["detail"], str)
    assert client.get("/api/groups", headers=erin).json() == []
    assert client.post("/api/groups/join", json={"inviteCode": ""}, headers=erin).status_code in (404, 422)


def test_only_creator_sees_invite_code(client: TestClient, signup):
    dana = signup("dana@example.com")
    erin = signup("erin@example.com")
    group = create_group(client, dana)
    join(client, erin, group["inviteCode"])

    assert client.get(f"/api/groups/{group['id']}", headers=dana).json()["inviteCode"] == group["inviteCode"]
    member_view = client.get(f"/api/groups/{group['id']}", headers=erin).json()
    assert "inviteCode" not in member_view
    assert member_view["isCreator"] is False


def test_nonmember_cannot_read_or_change_group(client: TestClient, signup):
    dana = signup("dana@example.com")
    mallory = signup("mallory@example.com")
    group = create_group(client, dana)
    expense = add_expense(client, dana, group["id"], participantIds=[group["createdBy"]])
    gid, eid = group["id"], expense["id"]

    assert client.get(f"/api/groups/{gid}", headers=mallory).status_code == 404
    assert client.patch(f"/api/groups/{gid}", json={"currency": "EUR"}, headers=mallory).status_code == 404
    body = {"description": "x", "amountMinor": 1, "date": "2026-09-01", "participantIds": [group["createdBy"]]}
    assert client.post(f"/api/groups/{gid}/expenses", json=body, headers=mallory).status_code == 404
    assert client.patch(f"/api/groups/{gid}/expenses/{eid}", json=body, headers=mallory).status_code == 404
    assert client.delete(f"/api/groups/{gid}/expenses/{eid}", headers=mallory).status_code == 404
    # Same answer as for a group that does not exist.
    assert client.get("/api/groups/no-such-group", headers=mallory).status_code == 404


def test_creator_can_change_currency_before_first_expense(client: TestClient, signup):
    dana = signup("dana@example.com")
    group = create_group(client, dana, currency="CHF")
    response = client.patch(f"/api/groups/{group['id']}", json={"currency": "EUR"}, headers=dana)
    assert response.status_code == 200
    assert response.json()["currency"] == "EUR"
    assert client.get("/api/groups", headers=dana).json()[0]["currency"] == "EUR"


def test_member_cannot_change_currency(client: TestClient, signup):
    dana = signup("dana@example.com")
    erin = signup("erin@example.com")
    group = create_group(client, dana)
    join(client, erin, group["inviteCode"])
    response = client.patch(f"/api/groups/{group['id']}", json={"currency": "EUR"}, headers=erin)
    assert response.status_code == 403
    assert client.get(f"/api/groups/{group['id']}", headers=dana).json()["currency"] == "CHF"


def test_currency_locked_after_first_expense(client: TestClient, signup):
    dana = signup("dana@example.com")
    erin = signup("erin@example.com")
    group = create_group(client, dana)
    join(client, erin, group["inviteCode"])
    # Even an expense entered by another member locks the currency.
    add_expense(client, erin, group["id"], participantIds=[group["createdBy"]])

    response = client.patch(f"/api/groups/{group['id']}", json={"currency": "EUR"}, headers=dana)
    assert response.status_code == 409
    assert client.get(f"/api/groups/{group['id']}", headers=dana).json()["currency"] == "CHF"
    # Re-sending the current currency is a harmless no-op.
    same = client.patch(f"/api/groups/{group['id']}", json={"currency": "CHF"}, headers=dana)
    assert same.status_code == 200


def test_currency_remains_locked_after_last_expense_is_deleted(client: TestClient, signup):
    dana = signup("dana@example.com")
    group = create_group(client, dana)
    expense = add_expense(client, dana, group["id"], participantIds=[group["createdBy"]])
    deletion = client.delete(f"/api/groups/{group['id']}/expenses/{expense['id']}", headers=dana)
    assert deletion.status_code == 204
    detail = client.get(f"/api/groups/{group['id']}", headers=dana).json()
    assert detail["expenses"] == []
    assert detail["currencyLocked"] is True
    response = client.patch(f"/api/groups/{group['id']}", json={"currency": "EUR"}, headers=dana)
    assert response.status_code == 409
    assert client.get(f"/api/groups/{group['id']}", headers=dana).json()["currency"] == "CHF"


def test_currency_change_validation(client: TestClient, signup):
    dana = signup("dana@example.com")
    group = create_group(client, dana)
    response = client.patch(f"/api/groups/{group['id']}", json={"currency": "XYZ"}, headers=dana)
    assert response.status_code == 422
