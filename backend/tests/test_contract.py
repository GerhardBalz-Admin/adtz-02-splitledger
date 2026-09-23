"""Checks that the FastAPI app implements exactly the operations in openapi.yaml."""

from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

CONTRACT_PATH = Path(__file__).resolve().parents[2] / "openapi.yaml"
METHODS = {"get", "post", "put", "patch", "delete"}


@pytest.fixture(scope="module")
def contract() -> dict:
    return yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))


def operations(spec: dict, prefix: str = "") -> dict[tuple[str, str], set[str]]:
    result = {}
    for path, item in spec["paths"].items():
        for method, operation in item.items():
            if method in METHODS:
                result[(prefix + path, method)] = set(operation["responses"])
    return result


def test_contract_server_uses_api_prefix(contract: dict):
    assert contract["servers"][0]["url"].endswith("/api")


def test_app_implements_every_contract_operation(client: TestClient, contract: dict):
    implemented = operations(client.app.openapi())
    expected = operations(contract, prefix="/api")
    assert set(implemented) == set(expected)


def test_success_status_codes_match_contract(client: TestClient, contract: dict):
    implemented = operations(client.app.openapi())
    for key, codes in operations(contract, prefix="/api").items():
        expected_success = {c for c in codes if c.startswith("2")}
        actual_success = {c for c in implemented[key] if c.startswith("2")}
        assert actual_success == expected_success, key


def test_contract_schemas_match_response_fields(client: TestClient, contract: dict):
    """Every property the contract lists appears in the app's schema of the same name, and vice versa."""
    app_schemas = client.app.openapi()["components"]["schemas"]
    for name in ("User", "Session", "GroupSummary", "GroupDetail", "Member", "Expense", "MemberBalance", "JoinResult"):
        contract_props = set(contract["components"]["schemas"][name]["properties"])
        app_props = set(app_schemas[name]["properties"])
        assert contract_props == app_props, name
