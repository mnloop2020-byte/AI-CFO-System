from __future__ import annotations

from io import BytesIO
from pathlib import Path
from zipfile import BadZipFile, ZipFile

from docx import Document as WordDocument
from pypdf import PdfReader


SUPPORTED_DOCUMENT_TYPES: dict[str, set[str]] = {
    ".pdf": {"application/pdf"},
    ".docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    },
    ".txt": {"text/plain"},
    ".md": {"text/markdown", "text/plain"},
    ".csv": {"text/csv", "text/plain", "application/csv"},
}


def validate_document_file(
    file_name: str,
    content_type: str | None,
    content: bytes,
    max_size_bytes: int,
) -> tuple[str, str]:
    safe_name = "".join(
        character for character in Path(file_name).name.strip() if character.isprintable()
    )[:255]
    suffix = Path(safe_name).suffix.lower()
    normalized_type = (content_type or "").split(";", 1)[0].strip().lower()

    if not safe_name or suffix not in SUPPORTED_DOCUMENT_TYPES:
        raise ValueError("Unsupported file type. Use PDF, DOCX, TXT, MD, or CSV.")

    if not content:
        raise ValueError("The selected document is empty.")

    if len(content) > max_size_bytes:
        limit_mb = max_size_bytes // (1024 * 1024)
        raise ValueError(f"The document exceeds the {limit_mb} MB size limit.")

    if normalized_type not in SUPPORTED_DOCUMENT_TYPES[suffix]:
        raise ValueError("The file extension and MIME type do not match.")

    if suffix == ".pdf" and not content.startswith(b"%PDF-"):
        raise ValueError("The uploaded file is not a valid PDF document.")

    if suffix == ".docx":
        try:
            with ZipFile(BytesIO(content)) as archive:
                if "word/document.xml" not in archive.namelist():
                    raise ValueError("The uploaded file is not a valid DOCX document.")
                if sum(item.file_size for item in archive.infolist()) > 50 * 1024 * 1024:
                    raise ValueError("The DOCX document expands beyond the safe processing limit.")
        except BadZipFile as error:
            raise ValueError("The uploaded file is not a valid DOCX document.") from error

    if suffix in {".txt", ".md", ".csv"}:
        if b"\x00" in content:
            raise ValueError("The uploaded text document contains binary data.")
        _decode_text(content)

    return safe_name, normalized_type


def _decode_text(content: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1256"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("The text encoding is not supported.")


def extract_document_text(file_name: str, content: bytes) -> str:
    suffix = Path(file_name).suffix.lower()

    if suffix == ".pdf":
        reader = PdfReader(BytesIO(content))
        text = "\n\n".join((page.extract_text() or "").strip() for page in reader.pages)
    elif suffix == ".docx":
        document = WordDocument(BytesIO(content))
        text = "\n".join(paragraph.text for paragraph in document.paragraphs)
    else:
        text = _decode_text(content)

    normalized_text = "\n".join(line.rstrip() for line in text.splitlines()).strip()
    if not normalized_text:
        raise ValueError("No readable text could be extracted from the document.")
    return normalized_text
