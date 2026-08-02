AI CFO System

<p align="center">
  <strong>An AI-powered financial management platform for small and medium-sized businesses</strong>
</p><p align="center">
  Multi-Agent Architecture • Financial CRM • RAG • Action Center • Bilingual Interface
</p>---

Overview

AI CFO System is an intelligent financial management platform designed to help small and medium-sized businesses understand their financial position, monitor daily operations, and make better data-driven decisions.

The platform combines a financial CRM with a multi-agent AI architecture. Each AI agent specializes in a specific financial domain, such as sales, accounting, cash flow, inventory, fraud detection, taxation, and executive reporting.

A central Orchestrator analyzes the user's request and routes it to the appropriate agent or group of agents.

The system supports both Arabic and English, including RTL and LTR layouts.

---

The Problem

Many small businesses still manage their financial operations using disconnected spreadsheets, manual calculations, and multiple software tools.

This creates several challenges:

- Financial data is distributed across different files and systems.
- Reports require significant manual work.
- Cash-flow problems may be discovered too late.
- Unpaid invoices are difficult to track.
- Low inventory levels can be missed.
- Suspicious or duplicated expenses may remain unnoticed.
- Business owners may not have a clear financial overview.
- Traditional financial systems show data but do not always recommend actions.

---

The Solution

AI CFO System brings financial data, AI analysis, reporting, and operational recommendations into one platform.

The system can:

- Manage customers, sales, expenses, invoices, and inventory.
- Analyze company financial data using specialized AI agents.
- Generate financial and executive reports.
- Answer questions about uploaded business documents using RAG.
- Detect low inventory, unpaid invoices, and suspicious expenses.
- Propose financial actions through a human-approval workflow.
- Protect company data using authentication, roles, and tenant isolation.
- Provide a bilingual Arabic and English user experience.

---

Main Features

Financial Dashboard

The dashboard provides a centralized overview of the company’s financial activity, including:

- Revenue indicators
- Expense indicators
- Sales activity
- Invoice status
- Inventory status
- Financial alerts
- Operational summaries

Financial CRM

The internal CRM allows users to manage:

- Customers
- Sales
- Expenses
- Inventory
- Invoices

Each module includes structured forms, validation, financial summaries, and company-level data isolation.

AI Financial Chat

Users can ask questions in Arabic or English using natural language.

Examples:

What were our total sales?

ما إجمالي المصروفات؟

Which products have low inventory?

ما قيمة الفواتير غير المدفوعة؟

The Orchestrator analyzes the question and selects the appropriate financial agent.

Financial Reports

The platform supports multiple report types, including:

- CFO Report
- Executive Report
- Sales Performance Report
- Cash Flow Report
- Inventory Report
- Financial Risk Report

Reports are generated from actual company data and displayed using structured Markdown.

Document Intelligence and RAG

Users can upload business documents and ask questions about their contents.

Supported document types include:

- PDF
- DOCX
- TXT
- Markdown
- CSV

The RAG pipeline performs:

1. Secure document upload
2. File validation
3. Text extraction
4. Text chunking
5. Embedding generation
6. Vector storage using pgvector
7. Semantic retrieval
8. Source-aware answer generation

When possible, responses include the source filename and relevant chunk number.

Action Center

The Action Center converts financial findings into proposed operational actions.

Examples include:

- Notify a customer about an overdue invoice.
- Alert the accountant about an unpaid invoice.
- Recommend reordering a low-stock product.
- Request clarification for a suspicious expense.
- Suggest postponing a non-essential expense during a cash shortage.

The workflow follows a human-in-the-loop model:

Financial event
      ↓
AI analysis
      ↓
Proposed action
      ↓
Owner or accountant approval
      ↓
Execution
      ↓
Audit log

The AI does not perform sensitive financial actions without authorized human approval.

---

Multi-Agent Architecture

AI CFO System uses specialized agents instead of depending on a single general-purpose prompt.

Each agent is responsible for a specific financial domain.

1. Orchestrator

The Orchestrator acts as the coordinator of the AI system.

Responsibilities:

- Understand user intent.
- Detect the language of the request.
- Select the appropriate agent.
- Route requests to one or multiple agents.
- Combine agent results when necessary.
- Maintain a consistent response structure.

2. Sales Analyst Agent

Responsibilities:

- Calculate completed sales revenue.
- Count completed sales.
- Calculate total units sold.
- Analyze sales status.
- Identify top-performing products.
- Summarize sales performance.

3. Accounting Agent

Responsibilities:

- Analyze total expenses.
- Group expenses by category.
- Analyze invoice statuses.
- Compare revenue and expenses.
- Calculate preliminary operating results.
- Summarize accounting activity.

4. Cash Flow Agent

Responsibilities:

- Analyze tracked cash inflows.
- Analyze tracked cash outflows.
- Calculate net tracked cash flow.
- Identify expected unpaid inflows.
- Summarize paid and unpaid invoices.
- Detect potential liquidity concerns.

5. Inventory Agent

Responsibilities:

- Monitor inventory quantities.
- Detect products below their reorder level.
- Calculate inventory cost value.
- Calculate inventory selling value.
- Identify low-stock products.
- Support reorder recommendations.

6. Fraud Detection Agent

Responsibilities:

- Detect flagged expenses.
- Identify potential duplicate expenses.
- Detect duplicate invoice numbers.
- Highlight unusual financial records.
- Produce risk-focused findings.

The Fraud Agent provides indicators for review. It does not automatically classify a transaction as proven fraud.

7. Tax Agent

Responsibilities:

- Calculate invoiced VAT.
- Group VAT by invoice status.
- Summarize tax-related invoice data.
- Provide structured tax information based on stored records.

«Tax outputs are informational and should be reviewed by a qualified accountant or tax professional before official use.»

8. Report Writer Agent

Responsibilities:

- Collect financial findings.
- Structure professional financial reports.
- Organize reports into clear sections.
- Generate CFO-level summaries.
- Present findings, risks, and recommended next steps.

9. CEO Agent

Responsibilities:

- Analyze the overall financial picture.
- Create executive summaries.
- Prioritize important business issues.
- Present high-level recommendations.
- Translate financial findings into management-focused language.

The system separates deterministic financial calculations from AI-generated explanations wherever possible. This reduces unsupported conclusions and improves reliability.

General Agent

The General Agent handles requests that do not belong to a specific financial domain and provides general guidance about the platform.

---

System Architecture

flowchart TD
    U["User"] --> F["Next.js Frontend"]
    F --> API["FastAPI Backend"]
    API --> O["AI Orchestrator"]

    O --> A1["Sales Agent"]
    O --> A2["Accounting Agent"]
    O --> A3["Cash Flow Agent"]
    O --> A4["Inventory Agent"]
    O --> A5["Fraud Agent"]
    O --> A6["Tax Agent"]
    O --> A7["Report Writer"]
    O --> A8["CEO Agent"]

    API --> DB["Supabase PostgreSQL"]
    API --> V["pgvector / RAG"]
    API --> R["Upstash Redis"]
    API --> LLM["OpenRouter"]
    F --> AUTH["Supabase Auth"]

---

Technology Stack

Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Lucide React
- React Markdown
- Remark GFM

Backend

- Python
- FastAPI
- Pydantic
- Uvicorn
- REST APIs
- Modular agent architecture

AI and RAG

- OpenRouter
- Large Language Models
- SentenceTransformers
- Embeddings
- Retrieval-Augmented Generation
- Semantic search
- pgvector

Data and Infrastructure

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase pgvector
- Upstash Redis
- Docker
- Vercel for the frontend
- Render for the Pilot backend deployment

---

Authentication and Authorization

The platform includes:

- User registration
- User login
- Auth callback handling
- Protected routes
- Password recovery flow
- Multi-factor authentication support
- Role-based access control
- Company membership validation
- Backend authorization checks

Supported roles include:

- "owner"
- "admin"
- "accountant"
- "viewer"

Permissions are enforced according to the user’s role.

---

Company Data Isolation

The current release follows a:

«Single Company + Multiple Users»

architecture.

The system retains a tenant-ready structure so it can support multiple companies in a future release without redesigning the entire database.

Important security rules:

- The frontend does not choose the active "company_id".
- The backend derives the company from the authenticated user’s membership.
- Financial records are filtered by company.
- Protected endpoints require a valid authenticated user.
- Sensitive Supabase keys are never exposed to the frontend.
- Storage buckets containing financial documents remain private.

---

Security

The project applies multiple security controls:

- Input validation
- Authentication and authorization
- Role-based permissions
- Tenant-aware database queries
- Protected API endpoints
- Private document storage
- File-size validation
- MIME-type validation
- File-signature validation
- Restricted document formats
- Secret management through environment variables
- Safe error handling
- CORS restrictions
- Human approval for sensitive actions
- Audit-friendly operational workflows

Secrets and API keys must never be committed to Git.

---

Reliability

The backend is designed with production reliability in mind.

Important reliability practices include:

- Structured validation
- Controlled exception handling
- Health checks
- Timeout handling
- Retry strategies where appropriate
- External service error handling
- Safe AI fallbacks
- Logging without exposing secrets
- Deterministic financial calculations
- Automated tests
- Separation between AI wording and financial business logic

---

Project Structure

AI-CFO-System/
├── frontend/
│   ├── app/
│   │   ├── auth/
│   │   ├── crm/
│   │   ├── dashboard/
│   │   ├── documents/
│   │   ├── intelligence/
│   │   ├── reports/
│   │   └── settings/
│   ├── components/
│   ├── lib/
│   └── public/
│
├── backend-python/
│   ├── app/
│   │   ├── agents/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── services/
│   │   ├── tools/
│   │   └── main.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── supabase/
│   └── migrations/
│
└── README.md

«The exact folder structure may evolve as the project is developed.»

---

API Overview

The FastAPI backend provides endpoints for:

System

GET /health

Authentication

GET /auth/me

AI Chat

POST /chat

Reports

POST /reports/generate

Financial CRM

/customers
/sales
/expenses
/inventory
/invoices

Documents and RAG

/documents

Interactive API documentation is available during local development at:

http://localhost:8000/docs

---

Local Development

Prerequisites

Install the following tools:

- Python 3.11 or later
- Node.js 20 or later
- npm
- Git
- A Supabase project
- An OpenRouter API key
- An Upstash Redis database

---

Clone the Repository

git clone https://github.com/mnloop2020-byte/AI-CFO-System.git
cd AI-CFO-System

---

Backend Setup

Enter the Python backend directory:

cd backend-python

Create a virtual environment:

Windows PowerShell

python -m venv .venv
.venv\Scripts\Activate.ps1

macOS or Linux

python3 -m venv .venv
source .venv/bin/activate

Install the dependencies:

pip install -r requirements.txt

Create the backend environment file from the provided example:

cp .env.example .env

On Windows PowerShell:

Copy-Item .env.example .env

Add the required values to ".env".

Do not commit this file.

Start the FastAPI development server:

uvicorn app.main:app --reload

The backend will be available at:

http://localhost:8000

API documentation:

http://localhost:8000/docs

Health check:

http://localhost:8000/health

---

Frontend Setup

Open another terminal and enter the frontend directory:

cd frontend

Install the dependencies:

npm install

Create the frontend environment file:

cp .env.example .env.local

On Windows PowerShell:

Copy-Item .env.example .env.local

Start the development server:

npm run dev

The frontend will be available at:

http://localhost:3000

---

Environment Variables

Use the project’s ".env.example" files as the authoritative source for environment variable names.

The system generally requires configuration for:

Backend

- Supabase project URL
- Supabase anonymous key
- Supabase service-role key
- OpenRouter API key
- Redis connection
- Allowed frontend origins
- AI model configuration
- Embedding model configuration

Frontend

- Supabase project URL
- Supabase publishable or anonymous key
- Backend API URL

Never place a service-role key or another server secret in a variable prefixed with "NEXT_PUBLIC_".

---

Running Tests

Backend Tests

From the "backend-python" directory:

pytest

For more detailed output:

pytest -v

Frontend Validation

From the "frontend" directory:

npm run lint
npm run build

A successful production build helps detect TypeScript, routing, and integration errors before deployment.

---

Docker

The backend includes Docker support to keep the deployment portable between hosting platforms.

Build the backend image:

docker build -t ai-cfo-backend ./backend-python

Run the container:

docker run --env-file ./backend-python/.env -p 8000:8000 ai-cfo-backend

Test the running container:

curl http://localhost:8000/health

The containerized architecture makes it easier to migrate between platforms such as Render and Google Cloud Run.

---

Deployment Architecture

The planned Pilot deployment uses:

Component| Platform
Frontend| Vercel
FastAPI Backend| Render
Database| Supabase PostgreSQL
Authentication| Supabase Auth
File Storage| Supabase Storage
Vector Search| Supabase pgvector
Redis| Upstash Redis
AI Models| OpenRouter

Production request flow:

Vercel Frontend
       ↓
Render FastAPI Backend
       ↓
AI Agents and Business Logic
       ↓
Supabase + Upstash + OpenRouter

The backend remains Docker-compatible so it can be migrated to Google Cloud Run when the project requires greater scalability or enterprise infrastructure.

---

Bilingual Support

The interface supports:

- Arabic
- English
- RTL layout
- LTR layout
- Translated navigation
- Translated authentication pages
- Translated CRM pages
- Bilingual AI questions
- Bilingual financial responses

Users can switch the application language from the interface.

---

Example Use Cases

Business Owner

A business owner can ask:

Give me an executive summary of the company's current financial situation.

The system can combine sales, expenses, cash flow, invoice, and inventory findings into a management-focused summary.

Accountant

An accountant can ask:

Show me the unpaid invoices and the total expected cash inflow.

The Cash Flow Agent retrieves the relevant records and calculates the expected unpaid inflow.

Inventory Manager

An inventory manager can ask:

Which products should be reordered?

The Inventory Agent compares current quantities with reorder levels.

Financial Reviewer

A financial reviewer can ask:

Are there any suspicious or duplicated expenses?

The Fraud Detection Agent searches for flagged records and potential duplicate patterns.

Document Analysis

A user can upload a financial document and ask:

What payment terms are mentioned in this document?

The Document Retrieval Agent searches the indexed document chunks and returns a source-aware answer.

---

Current Project Status

Implemented

- Next.js financial dashboard
- Python FastAPI backend
- Financial CRM modules
- Specialized financial agents
- Keyword-based Arabic and English routing
- Supabase PostgreSQL integration
- Authentication and protected routes
- Company-level data isolation
- Role-based access controls
- Arabic and English interface
- RTL and LTR support
- AI financial chat
- Financial report generation
- Markdown report rendering
- Secure document upload
- Document processing
- Embedding generation
- pgvector semantic search
- RAG document retrieval
- Source-aware document answers
- Action Center foundation
- Security and reliability tests

In Progress or Planned

- Final production deployment
- Complete PDF report storage and history workflow
- Expanded monitoring and observability
- Advanced financial forecasting
- More deterministic validation for executive recommendations
- Production-ready notification integrations
- Extended Action Center execution tools
- Multi-company support for a future release
- Enterprise infrastructure migration when required

---

Important Limitations

- AI-generated financial recommendations must be reviewed by an authorized human.
- The system does not replace a licensed accountant, auditor, or tax advisor.
- Financial calculations should be validated before official reporting.
- Fraud findings are risk indicators, not legal conclusions.
- Tax outputs depend on the quality and completeness of stored data.
- AI responses may be affected by missing, incomplete, or incorrect company records.
- Sensitive actions require explicit user approval.

---

Product Roadmap

Phase 1 — Core Financial Platform

- Financial database
- CRM modules
- FastAPI backend
- Dashboard
- Authentication
- Company isolation

Phase 2 — Multi-Agent Intelligence

- Specialized financial agents
- Orchestrator
- Bilingual AI chat
- Data-backed financial analysis
- Executive summaries

Phase 3 — Documents and Reports

- Secure document upload
- RAG pipeline
- Semantic retrieval
- Source-aware answers
- Financial reports
- PDF and report history improvements

Phase 4 — Operational Intelligence

- Action Center
- Human approval workflow
- Financial notifications
- Audit logs
- Advanced forecasting
- Production deployment
- Monitoring and scaling

---

Design Principles

The project follows these engineering principles:

- Deterministic calculations before AI interpretation
- Clear separation of responsibilities
- Modular and reusable components
- Secure-by-default data access
- Human approval for sensitive actions
- Bilingual accessibility
- Tenant-ready architecture
- Portable deployment using Docker
- Testable business logic
- Maintainable and scalable code organization

---

Future Improvements

Potential future improvements include:

- Advanced cash-flow forecasting
- Financial anomaly scoring
- Automatic invoice reminders
- WhatsApp and email integrations
- Accounting software integrations
- Bank transaction integrations
- Interactive financial charts
- Scheduled reports
- Organization-level audit logs
- Multi-company workspaces
- Custom financial policies
- Additional AI model providers
- Enterprise deployment on Google Cloud Run

---

Repository

GitHub:

"https://github.com/mnloop2020-byte/AI-CFO-System" (https://github.com/mnloop2020-byte/AI-CFO-System)

---

Author

Mohammed Alhafizi

Software Developer specializing in:

- Python and FastAPI
- AI-powered applications
- Multi-agent systems
- Retrieval-Augmented Generation
- Supabase and PostgreSQL
- pgvector and semantic search
- Next.js and TypeScript
- AI APIs and automation

GitHub:

"https://github.com/mnloop2020-byte" (https://github.com/mnloop2020-byte)

---

License

This project is currently provided for portfolio, demonstration, and evaluation purposes.

All rights are reserved unless a separate license file is added to the repository.

---

<p align="center">
  Built with Python, FastAPI, Next.js, Supabase, pgvector, and AI
</p>
