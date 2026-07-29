from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Annotated, Any, Iterable

from pydantic import BeforeValidator, PlainSerializer, WithJsonSchema


MONEY_QUANTUM = Decimal("0.01")
MONEY_ROUNDING = ROUND_HALF_UP
MAX_STANDARD_MONEY = Decimal("1000000000.00")
MONEY_SERIALIZATION_SCHEMA = {
    "type": "string",
    "pattern": r"^-?\d+\.\d{2}$",
    "examples": ["0.00", "1234.50"],
}


def parse_money(value: object) -> Decimal:
    """Parse and quantize a financial value without binary-float arithmetic."""
    if isinstance(value, bool):
        raise ValueError("Money values must be decimal numbers.")

    if isinstance(value, Decimal):
        amount = value
    elif isinstance(value, (str, int, float)):
        text = str(value).strip()
        if not text:
            raise ValueError("Money values cannot be empty.")
        try:
            amount = Decimal(text)
        except InvalidOperation as exc:
            raise ValueError("Money values must be valid decimal numbers.") from exc
    else:
        raise ValueError("Money values must be valid decimal numbers.")

    if not amount.is_finite():
        raise ValueError("Money values must be finite.")

    return amount.quantize(MONEY_QUANTUM, rounding=MONEY_ROUNDING)


def money_to_string(value: Decimal | str | int | float) -> str:
    return format(parse_money(value), ".2f")


def sum_money(values: Iterable[Decimal | str | int | float]) -> Decimal:
    total = sum((parse_money(value) for value in values), Decimal("0.00"))
    return parse_money(total)


def multiply_money(
    amount: Decimal | str | int | float,
    multiplier: Decimal | str | int,
) -> Decimal:
    if isinstance(multiplier, bool):
        raise ValueError("Money multipliers must be numeric.")
    try:
        factor = multiplier if isinstance(multiplier, Decimal) else Decimal(str(multiplier))
    except InvalidOperation as exc:
        raise ValueError("Money multipliers must be numeric.") from exc
    if not factor.is_finite():
        raise ValueError("Money multipliers must be finite.")
    return parse_money(parse_money(amount) * factor)


def subtract_money(
    minuend: Decimal | str | int | float,
    subtrahend: Decimal | str | int | float,
) -> Decimal:
    return parse_money(parse_money(minuend) - parse_money(subtrahend))


def serialize_decimal_values(value: Any) -> Any:
    """Convert Decimal values recursively for JSON/PostgREST boundaries."""
    if isinstance(value, Decimal):
        return money_to_string(value)
    if isinstance(value, dict):
        return {
            key: serialize_decimal_values(nested)
            for key, nested in value.items()
        }
    if isinstance(value, list):
        return [serialize_decimal_values(nested) for nested in value]
    if isinstance(value, tuple):
        return [serialize_decimal_values(nested) for nested in value]
    return value


MoneyDecimal = Annotated[
    Decimal,
    BeforeValidator(parse_money),
    PlainSerializer(money_to_string, return_type=str, when_used="json"),
    WithJsonSchema(MONEY_SERIALIZATION_SCHEMA, mode="serialization"),
]
