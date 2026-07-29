from collections.abc import Callable
from datetime import datetime, timezone

from app.agents.cashflow_agent import run_cashflow_agent
from app.agents.ceo_agent import run_ceo_agent
from app.agents.fraud_agent import run_fraud_agent
from app.agents.report_writer_agent import run_report_writer_agent
from app.agents.sales_agent import run_sales_agent
from app.agents.tax_agent import run_tax_agent
from app.schemas.chat_schema import ChatMessage
from app.schemas.report_schema import (
    GenerateReportRequest,
    GenerateReportResponse,
    ReportGenerator,
    ReportType,
)


AgentRunner = Callable[[str, list[ChatMessage] | None], str]


REPORT_RUNNERS: dict[
    ReportType,
    tuple[ReportGenerator, AgentRunner],
] = {
    "complete_cfo": (
        "report_writer",
        run_report_writer_agent,
    ),
    "executive_brief": (
        "ceo",
        run_ceo_agent,
    ),
    "sales_performance": (
        "sales",
        run_sales_agent,
    ),
    "cash_flow_summary": (
        "cashflow",
        run_cashflow_agent,
    ),
    "tax_summary": (
        "tax",
        run_tax_agent,
    ),
    "risk_review": (
        "fraud",
        run_fraud_agent,
    ),
}


REPORT_PROMPTS: dict[ReportType, dict[str, str]] = {
    "complete_cfo": {
        "en": (
            "Generate a complete CFO report from all verified data available "
            "to your tools. Separate verified facts, limitations, risks, and "
            "recommended next actions. Use concise Markdown."
        ),
        "ar": (
            "أنشئ تقريرًا شاملًا للمدير المالي من جميع البيانات المتحقق منها "
            "والمتاحة لأدواتك. افصل بوضوح بين الحقائق والقيود والمخاطر "
            "والإجراءات التالية المقترحة. استخدم Markdown منسقًا ومختصرًا."
        ),
    },
    "executive_brief": {
        "en": (
            "Prepare a concise executive brief from verified CFO data. "
            "Separate verified facts from cautious recommendations and do not "
            "infer causes, trends, solvency, or future outcomes."
        ),
        "ar": (
            "أعد ملخصًا تنفيذيًا موجزًا من بيانات المدير المالي المتحقق منها. "
            "افصل الحقائق عن التوصيات الحذرة، ولا تستنتج أسبابًا أو اتجاهات "
            "أو ملاءة مالية أو نتائج مستقبلية."
        ),
    },
    "sales_performance": {
        "en": (
            "Generate a structured sales performance report using only the "
            "verified sales data available to your tools. Cover completed "
            "revenue, units, statuses, and supported product findings."
        ),
        "ar": (
            "أنشئ تقريرًا منظمًا لأداء المبيعات باستخدام بيانات المبيعات "
            "المتحقق منها فقط. غطِ الإيرادات المكتملة والوحدات والحالات "
            "واستنتاجات المنتجات المدعومة بالبيانات."
        ),
    },
    "cash_flow_summary": {
        "en": (
            "Generate a cash-flow summary from verified data. Keep completed "
            "revenue, received cash, recorded outflows, outstanding "
            "receivables, net tracked cash flow, and bank balance separate."
        ),
        "ar": (
            "أنشئ ملخصًا للتدفق النقدي من البيانات المتحقق منها. افصل بين "
            "الإيرادات المكتملة والنقد المستلم والتدفقات الخارجة والذمم "
            "المدينة وصافي التدفق النقدي المتتبع والرصيد البنكي."
        ),
    },
    "tax_summary": {
        "en": (
            "Generate a tax summary using verified invoice data. Clearly "
            "state that invoiced VAT is not the final VAT payable when input "
            "VAT or tax jurisdiction data is unavailable."
        ),
        "ar": (
            "أنشئ ملخصًا ضريبيًا باستخدام بيانات الفواتير المتحقق منها. وضح "
            "أن ضريبة القيمة المضافة المفوترة ليست الضريبة النهائية المستحقة "
            "عندما لا تتوفر ضريبة المدخلات أو بيانات الاختصاص الضريبي."
        ),
    },
    "risk_review": {
        "en": (
            "Generate a neutral risk-review report using verified data only. "
            "Treat flagged expenses and duplicate candidates as items for "
            "human review, never as confirmed fraud or misconduct."
        ),
        "ar": (
            "أنشئ تقريرًا محايدًا لمراجعة المخاطر باستخدام البيانات المتحقق "
            "منها فقط. تعامل مع المصروفات المعلّمة واحتمالات التكرار كعناصر "
            "تحتاج مراجعة بشرية، وليس كاحتيال أو مخالفة مؤكدة."
        ),
    },
}


def generate_report(
    request: GenerateReportRequest,
) -> GenerateReportResponse:
    generator, runner = REPORT_RUNNERS[request.report_type]
    prompt = REPORT_PROMPTS[request.report_type][request.language]
    content = runner(prompt, None)

    return GenerateReportResponse(
        report_type=request.report_type,
        generator=generator,
        language=request.language,
        content=content,
        generated_at=datetime.now(timezone.utc),
        stored=False,
    )


# This service intentionally does not store reports or create PDF files yet.
