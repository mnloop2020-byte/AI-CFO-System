from decimal import Decimal

import pytest
from pydantic import BaseModel, ValidationError

from app.money import (
    MoneyDecimal,
    money_to_string,
    multiply_money,
    parse_money,
    serialize_decimal_values,
    sum_money,
)


class MoneyEnvelope(BaseModel):
    amount: MoneyDecimal


def test_decimal_addition_avoids_binary_float_error():
    assert sum_money((Decimal("0.1"), Decimal("0.2"))) == Decimal("0.30")


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("1.004", Decimal("1.00")),
        ("1.005", Decimal("1.01")),
        ("-1.005", Decimal("-1.01")),
        ("0.001", Decimal("0.00")),
        ("999999999.999", Decimal("1000000000.00")),
    ],
)
def test_money_uses_two_places_and_round_half_up(raw: str, expected: Decimal):
    assert parse_money(raw) == expected


def test_money_multiplication_rounds_at_the_result_boundary():
    assert multiply_money("0.335", 3) == Decimal("1.02")


def test_money_json_serializes_as_a_fixed_decimal_string():
    envelope = MoneyEnvelope.model_validate({"amount": "12.345"})

    assert envelope.amount == Decimal("12.35")
    assert envelope.model_dump() == {"amount": Decimal("12.35")}
    assert envelope.model_dump(mode="json") == {"amount": "12.35"}
    assert envelope.model_dump_json() == '{"amount":"12.35"}'
    assert MoneyEnvelope.model_validate_json('{"amount":"12.345"}').amount == Decimal(
        "12.35"
    )


def test_money_response_schema_declares_a_fixed_decimal_string():
    amount_schema = MoneyEnvelope.model_json_schema(
        mode="serialization"
    )["properties"]["amount"]

    assert amount_schema["type"] == "string"
    assert amount_schema["pattern"] == r"^-?\d+\.\d{2}$"


@pytest.mark.parametrize("invalid", [True, "", "NaN", "Infinity", object()])
def test_money_rejects_invalid_or_non_finite_values(invalid: object):
    with pytest.raises((ValueError, ValidationError)):
        MoneyEnvelope.model_validate({"amount": invalid})


def test_money_to_string_preserves_trailing_zeroes():
    assert money_to_string("10") == "10.00"


def test_nested_decimal_values_serialize_without_float_conversion():
    payload = {
        "amount": Decimal("12.30"),
        "evidence": [Decimal("0.10"), {"vat": Decimal("2.005")}],
    }

    assert serialize_decimal_values(payload) == {
        "amount": "12.30",
        "evidence": ["0.10", {"vat": "2.01"}],
    }
