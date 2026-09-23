import pytest
from fastapi.testclient import TestClient

from conftest import add_expense, balances, create_group, join

GROUP = "g_flat4b"
DANA, ANNA, BEN, CHIARA = "u_dana", "u_anna", "u_ben", "u_chiara"


def expense_body(**overrides) -> dict:
    body = {"description": "Snacks", "amountMinor": 1000, "date": "2026-09-01", "participantIds": [DANA]}
    body.update(overrides)
    return body


def test_demo_group_balances_match_design(demo_client: TestClient, login):
    dana = login("dana")
    detail = demo_client.get(f"/api/groups/{GROUP}", headers=dana).json()
    assert [m["id"] for m in detail["members"]] == [DANA, ANNA, BEN, CHIARA]
    assert [e["description"] for e in detail["expenses"]] == [
        "Groceries",
        "Cleaning supplies",
        "Concert tickets",
        "Internet, September",
    ]
    assert detail["balances"] == [
        {"memberId": DANA, "balance": 8166},
        {"memberId": ANNA, "balance": 1667},
        {"memberId": BEN, "balance": -4833},
        {"memberId": CHIARA, "balance": -5000},
    ]
    summary = next(g for g in demo_client.get("/api/groups", headers=dana).json() if g["id"] == GROUP)
    assert summary["myBalance"] == 8166
    assert summary["expenseCount"] == 4


def test_spec_example_balances(client: TestClient, signup):
    a, b, c = signup("a@example.com"), signup("b@example.com"), signup("c@example.com")
    group = create_group(client, a)
    join(client, b, group["inviteCode"])
    join(client, c, group["inviteCode"])
    ids = [m["id"] for m in client.get(f"/api/groups/{group['id']}", headers=a).json()["members"]]
    add_expense(client, a, group["id"], amountMinor=9000, participantIds=ids)
    assert list(balances(client, a, group["id"]).values()) == [6000, -3000, -3000]


def test_payer_comes_from_the_token_not_the_body(demo_client: TestClient, login):
    ben = login("ben")
    body = expense_body(payerId=DANA, payer_id=DANA, participantIds=[DANA, ANNA, BEN])
    response = demo_client.post(f"/api/groups/{GROUP}/expenses", json=body, headers=ben)
    assert response.status_code == 201
    expense = response.json()
    assert expense["payerId"] == BEN
    assert set(expense) == {"id", "description", "amountMinor", "date", "payerId", "participantIds", "createdAt"}


def test_created_expense_is_listed_with_its_date(demo_client: TestClient, login):
    dana = login("dana")
    created = demo_client.post(
        f"/api/groups/{GROUP}/expenses", json=expense_body(description="  Old bill ", date="2026-01-15"), headers=dana
    ).json()
    assert created["description"] == "Old bill"
    assert created["date"] == "2026-01-15"
    expenses = demo_client.get(f"/api/groups/{GROUP}", headers=dana).json()["expenses"]
    assert expenses[-1]["id"] == created["id"]  # oldest date sorts last
    assert expenses[-1]["date"] == "2026-01-15"


def test_payer_may_be_excluded_and_gets_full_credit(demo_client: TestClient, login):
    ben = login("ben")
    before = balances(demo_client, ben, GROUP)
    demo_client.post(
        f"/api/groups/{GROUP}/expenses", json=expense_body(amountMinor=5000, participantIds=[ANNA, CHIARA]), headers=ben
    )
    after = balances(demo_client, ben, GROUP)
    assert after[BEN] - before[BEN] == 5000
    assert after[ANNA] - before[ANNA] == -2500
    assert after[CHIARA] - before[CHIARA] == -2500


def test_remainder_goes_to_selected_members_in_join_order(demo_client: TestClient, login):
    chiara = login("chiara")
    before = balances(demo_client, chiara, GROUP)
    # Listed out of order on purpose; join order is Dana, Anna, Ben, Chiara.
    response = demo_client.post(
        f"/api/groups/{GROUP}/expenses",
        json=expense_body(amountMinor=1001, participantIds=[CHIARA, BEN, ANNA]),
        headers=chiara,
    )
    assert response.json()["participantIds"] == [ANNA, BEN, CHIARA]
    after = balances(demo_client, chiara, GROUP)
    delta = {member: after[member] - before[member] for member in after}
    assert delta == {DANA: 0, ANNA: -334, BEN: -334, CHIARA: 1001 - 333}
    assert sum(after.values()) == 0


def test_add_edit_delete_recalculate_and_sum_to_zero(demo_client: TestClient, login):
    dana = login("dana")
    created = demo_client.post(f"/api/groups/{GROUP}/expenses", json=expense_body(amountMinor=10000,
                               participantIds=[DANA, ANNA, BEN]), headers=dana).json()
    after_add = balances(demo_client, dana, GROUP)
    assert after_add[DANA] == 8166 + 10000 - 3334
    assert sum(after_add.values()) == 0

    edited = demo_client.patch(
        f"/api/groups/{GROUP}/expenses/{created['id']}",
        json=expense_body(description="Fixed", amountMinor=333, date="2026-09-02", participantIds=[CHIARA]),
        headers=dana,
    )
    assert edited.status_code == 200
    assert edited.json()["description"] == "Fixed"
    assert edited.json()["payerId"] == DANA
    assert edited.json()["createdAt"] == created["createdAt"]
    after_edit = balances(demo_client, dana, GROUP)
    assert after_edit[DANA] == 8166 + 333
    assert after_edit[CHIARA] == -5000 - 333
    assert sum(after_edit.values()) == 0

    deleted = demo_client.delete(f"/api/groups/{GROUP}/expenses/{created['id']}", headers=dana)
    assert deleted.status_code == 204
    assert list(balances(demo_client, dana, GROUP).values()) == [8166, 1667, -4833, -5000]
    missing = demo_client.delete(f"/api/groups/{GROUP}/expenses/{created['id']}", headers=dana)
    assert missing.status_code == 404


def test_only_expense_creator_can_edit_or_delete(demo_client: TestClient, login):
    ben = login("ben")
    # e_groceries was entered by Dana.
    edit = demo_client.patch(f"/api/groups/{GROUP}/expenses/e_groceries", json=expense_body(), headers=ben)
    assert edit.status_code == 403
    assert demo_client.delete(f"/api/groups/{GROUP}/expenses/e_groceries", headers=ben).status_code == 403
    # Other members can still see it, unchanged.
    expenses = demo_client.get(f"/api/groups/{GROUP}", headers=ben).json()["expenses"]
    groceries = next(e for e in expenses if e["id"] == "e_groceries")
    assert groceries["amountMinor"] == 9000


def test_expense_must_belong_to_the_group_in_the_path(demo_client: TestClient, login):
    dana = login("dana")
    # e_train belongs to Ticino weekend, where Dana is a member but Ben is the payer.
    assert demo_client.delete(f"/api/groups/{GROUP}/expenses/e_train", headers=dana).status_code == 404
    other = demo_client.post(
        "/api/groups/g_ticino/expenses", json=expense_body(participantIds=[DANA]), headers=dana
    ).json()
    assert demo_client.delete(f"/api/groups/{GROUP}/expenses/{other['id']}", headers=dana).status_code == 404


@pytest.mark.parametrize(
    "overrides",
    [
        {"description": "   "},
        {"description": "x" * 121},
        {"amountMinor": 0},
        {"amountMinor": -500},
        {"amountMinor": 12.5},
        {"amountMinor": "1000"},
        {"amountMinor": True},
        {"amountMinor": 100_000_000_000},
        {"date": "2026-02-30"},
        {"date": "21.09.2026"},
        {"date": 1758412800},
        {"participantIds": []},
        {"participantIds": [DANA, DANA]},
        {"participantIds": ["u_stranger"]},
        {"participantIds": [DANA, "u_stranger"]},
    ],
)
def test_expense_validation(demo_client: TestClient, login, overrides):
    dana = login("dana")
    response = demo_client.post(f"/api/groups/{GROUP}/expenses", json=expense_body(**overrides), headers=dana)
    assert response.status_code == 422, response.text
    assert isinstance(response.json()["detail"], str)
    # Same rules on edit.
    edit = demo_client.patch(f"/api/groups/{GROUP}/expenses/e_groceries", json=expense_body(**overrides), headers=dana)
    assert edit.status_code == 422
    assert len(demo_client.get(f"/api/groups/{GROUP}", headers=dana).json()["expenses"]) == 4


def test_participant_from_another_group_is_rejected(demo_client: TestClient, login, ):
    ben = login("ben")
    # Anna is in Flat 4B but not in Ticino weekend.
    response = demo_client.post("/api/groups/g_ticino/expenses", json=expense_body(participantIds=[ANNA]), headers=ben)
    assert response.status_code == 422


def test_expenses_sorted_newest_date_first(client: TestClient, signup):
    dana = signup("dana@example.com")
    group = create_group(client, dana)
    me = group["createdBy"]
    for description, day in (("b", "2026-09-10"), ("a", "2026-09-12"), ("c", "2026-09-10")):
        add_expense(client, dana, group["id"], description=description, date=day, participantIds=[me])
    expenses = client.get(f"/api/groups/{group['id']}", headers=dana).json()["expenses"]
    # Same date: the one created later comes first.
    assert [e["description"] for e in expenses] == ["a", "c", "b"]
