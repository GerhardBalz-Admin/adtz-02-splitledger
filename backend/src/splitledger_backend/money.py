"""Equal splits and net balances, always in integer minor units (cents)."""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass


def split_equally(total_minor: int, participant_ids: Sequence[str]) -> dict[str, int]:
    """Split `total_minor` equally among `participant_ids`, which must be in group join order.

    Each participant gets the floor share; the leftover minor units go one each
    to the first participants, so the shares always add up to the total.
    """
    if total_minor <= 0:
        raise ValueError("total must be positive")
    if not participant_ids:
        raise ValueError("at least one participant is required")
    base, remainder = divmod(total_minor, len(participant_ids))
    return {member_id: base + (1 if index < remainder else 0) for index, member_id in enumerate(participant_ids)}


@dataclass(frozen=True)
class ExpenseShareInput:
    payer_id: str
    amount_minor: int
    participant_ids: Sequence[str]


def compute_balances(member_ids: Sequence[str], expenses: Iterable[ExpenseShareInput]) -> dict[str, int]:
    """Net balance per member: amount paid minus allocated shares.

    `member_ids` is the group's join order; it decides who receives leftover cents,
    whatever order an expense lists its participants in.
    """
    balances = dict.fromkeys(member_ids, 0)
    join_index = {member_id: index for index, member_id in enumerate(member_ids)}
    for expense in expenses:
        balances[expense.payer_id] = balances.get(expense.payer_id, 0) + expense.amount_minor
        ordered = sorted(expense.participant_ids, key=lambda m: join_index.get(m, len(join_index)))
        for member_id, share in split_equally(expense.amount_minor, ordered).items():
            balances[member_id] = balances.get(member_id, 0) - share
    return balances
