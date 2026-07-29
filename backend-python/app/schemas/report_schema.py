from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


ReportType = Literal[
    "complete_cfo",
    "executive_brief",
    "sales_performance",
    "cash_flow_summary",
    "tax_summary",
    "risk_review",
]

ReportLanguage = Literal["en", "ar"]

ReportGenerator = Literal[
    "report_writer",
    "ceo",
    "sales",
    "cashflow",
    "tax",
    "fraud",
]


class GenerateReportRequest(BaseModel):
    report_type: ReportType
    language: ReportLanguage = "en"
    data_range: Literal["all"] = "all"


class GenerateReportResponse(BaseModel):
    report_type: ReportType
    generator: ReportGenerator
    language: ReportLanguage
    content: str
    generated_at: datetime
    stored: bool = False


class CreateReportPdfRequest(BaseModel):
    report_type: ReportType
    language: ReportLanguage = "en"
    content: str = Field(min_length=1, max_length=100_000)
    generated_at: datetime


class StoreReportRequest(CreateReportPdfRequest):
    generator: ReportGenerator


class StoredReport(BaseModel):
    id: UUID
    report_type: ReportType
    generator: ReportGenerator
    language: ReportLanguage
    generated_at: datetime
    file_name: str
    created_at: datetime


class ReportDownloadResponse(BaseModel):
    url: str
    file_name: str
    expires_at: datetime


# Reports currently use every record available to the selected agent.
# Additional date ranges should be added only after the tools support them.
