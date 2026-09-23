import pytest

from splitledger_backend.money import ExpenseShareInput, compute_balances, split_equally


def test_split_evenly():
    assert split_equally(9000, ["a", "b", "c"]) == {"a": 3000, "b": 3000, "c": 3000}


def test_leftover_cents_go_to_first_participants():
    assert split_equally(10000, ["a", "b", "c"]) == {"a": 3334, "b": 3333, "c": 3333}
    assert split_equally(1002, ["a", "b", "c", "d"]) == {"a": 251, "b": 251, "c": 250, "d": 250}
    assert split_equally(2, ["a", "b", "c"]) == {"a": 1, "b": 1, "c": 0}


@pytest.mark.parametrize("total", [1, 7, 99, 100, 1001, 99_999])
@pytest.mark.parametrize("n", [1, 2, 3, 6, 7])
def test_split_preserves_every_minor_unit(total, n):
    shares = split_equally(total, [f"m{i}" for i in range(n)])
    assert sum(shares.values()) == total
    assert max(shares.values()) - min(shares.values()) <= 1


def test_split_rejects_bad_input():
    with pytest.raises(ValueError):
        split_equally(100, [])
    with pytest.raises(ValueError):
        split_equally(0, ["a"])


def test_balances_use_join_order_for_remainders():
    expenses = [ExpenseShareInput(payer_id="b", amount_minor=1000, participant_ids=["c", "b", "a"])]
    assert compute_balances(["a", "b", "c"], expenses) == {"a": -334, "b": 667, "c": -333}


def test_balances_sum_to_zero():
    members = ["a", "b", "c", "d"]
    expenses = [
        ExpenseShareInput(payer_id="a", amount_minor=9000, participant_ids=["a", "b", "c"]),
        ExpenseShareInput(payer_id="c", amount_minor=1000, participant_ids=["a", "b", "c"]),
        ExpenseShareInput(payer_id="a", amount_minor=5000, participant_ids=["b", "d"]),
        ExpenseShareInput(payer_id="b", amount_minor=10000, participant_ids=members),
    ]
    result = compute_balances(members, expenses)
    assert result == {"a": 8166, "b": 1667, "c": -4833, "d": -5000}
    assert sum(result.values()) == 0
