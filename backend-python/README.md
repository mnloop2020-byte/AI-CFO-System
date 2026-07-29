# AI CFO Python Backend

This folder contains the FastAPI backend for the AI CFO system.

## Setup

```bash
python -m venv .venv
.venv\\Scripts\\Activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

## Notes

- Supabase database migrations are stored in `../supabase/migrations`.
- RAG document upload requires
  `20260719193000_create_rag_documents.sql` before `/rag/documents` can be used.
- RAG uploads are development-only until Supabase Auth, tenant membership,
  and RLS policies are implemented. The Storage bucket must remain private.
