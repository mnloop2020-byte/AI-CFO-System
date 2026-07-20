from io import BytesIO
from unittest import TestCase

from docx import Document

from app.agents.orchestrator import select_agent
from app.rag.extract import extract_document_text, validate_document_file
from app.rag.ingest import chunk_text
from app.schemas.rag_schema import DocumentSource
from app.services.chat_service import _append_source_list


class RagDocumentTests(TestCase):
    def test_text_validation_and_extraction(self) -> None:
        content = "سياسة اختبار آمنة".encode("utf-8")
        file_name, mime_type = validate_document_file(
            "policy.txt",
            "text/plain",
            content,
            10 * 1024 * 1024,
        )
        self.assertEqual(file_name, "policy.txt")
        self.assertEqual(mime_type, "text/plain")
        self.assertEqual(extract_document_text(file_name, content), "سياسة اختبار آمنة")

    def test_docx_validation_and_extraction(self) -> None:
        document = Document()
        document.add_paragraph("Development document test")
        buffer = BytesIO()
        document.save(buffer)
        content = buffer.getvalue()

        validate_document_file(
            "policy.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            content,
            10 * 1024 * 1024,
        )
        self.assertIn("Development document test", extract_document_text("policy.docx", content))

    def test_fake_pdf_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            validate_document_file(
                "fake.pdf",
                "application/pdf",
                b"not a pdf",
                10 * 1024 * 1024,
            )

    def test_long_text_is_split_into_overlapping_chunks(self) -> None:
        self.assertGreaterEqual(len(chunk_text("A" * 2_500)), 3)

    def test_document_questions_route_to_retrieval_agent(self) -> None:
        self.assertEqual(
            select_agent("According to the uploaded document, what is the threshold?"),
            "document",
        )
        self.assertEqual(
            select_agent("وفقًا للمستند، ما هي سياسة الموافقة؟"),
            "document",
        )

    def test_existing_source_citation_is_not_duplicated(self) -> None:
        source = DocumentSource(
            document_id="00000000-0000-0000-0000-000000000002",
            file_name="rag-source-test.txt",
            chunk_index=0,
            excerpt="test",
            similarity=0.9,
        )
        reply = "Answer [Source 1: rag-source-test.txt, chunk 1]."
        self.assertEqual(
            _append_source_list(reply, [source], "document question"),
            reply,
        )
