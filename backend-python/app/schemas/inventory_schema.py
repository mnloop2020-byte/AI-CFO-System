from pydantic import BaseModel, ConfigDict, Field, field_validator


class InventoryInput(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        allow_inf_nan=False,
    )

    @field_validator("sku", check_fields=False)
    @classmethod
    def normalize_sku(cls, value: str | None) -> str | None:
        return value.upper() if value else None


class InventoryCreate(InventoryInput):
    product_name: str = Field(min_length=1, max_length=200)
    sku: str | None = Field(default=None, max_length=100)
    quantity: int = Field(default=0, ge=0, le=1_000_000_000)
    reorder_level: int = Field(default=5, ge=0, le=1_000_000_000)
    cost_price: float = Field(default=0, ge=0, le=1_000_000_000)
    selling_price: float = Field(default=0, ge=0, le=1_000_000_000)


class InventoryUpdate(InventoryInput):
    product_name: str | None = Field(default=None, min_length=1, max_length=200)
    sku: str | None = Field(default=None, max_length=100)
    quantity: int | None = Field(default=None, ge=0, le=1_000_000_000)
    reorder_level: int | None = Field(default=None, ge=0, le=1_000_000_000)
    cost_price: float | None = Field(default=None, ge=0, le=1_000_000_000)
    selling_price: float | None = Field(default=None, ge=0, le=1_000_000_000)


class InventoryResponse(BaseModel):
    id: str
    product_name: str
    sku: str | None = None
    quantity: int
    reorder_level: int
    cost_price: float
    selling_price: float
    last_sold: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
