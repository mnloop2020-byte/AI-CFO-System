import re

from pydantic import BaseModel, ConfigDict, Field, field_validator


_EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_PHONE_PATTERN = re.compile(r"^[+0-9][0-9\s().-]{5,30}$")


class CustomerInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("email", check_fields=False)
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if not value:
            return None
        normalized = value.lower()
        if len(normalized) > 254 or not _EMAIL_PATTERN.fullmatch(normalized):
            raise ValueError("A valid email address is required.")
        return normalized

    @field_validator("phone", check_fields=False)
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        if not value:
            return None
        if not _PHONE_PATTERN.fullmatch(value):
            raise ValueError("A valid phone number is required.")
        return value


class CustomerCreate(CustomerInput):
    name: str = Field(min_length=1, max_length=200)
    email: str | None = None
    phone: str | None = None
    company_name: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=4000)


class CustomerUpdate(CustomerInput):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    email: str | None = None
    phone: str | None = None
    company_name: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=4000)


class CustomerResponse(BaseModel):
    id: str
    name: str
    email: str | None = None
    phone: str | None = None
    company_name: str | None = None
    notes: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
