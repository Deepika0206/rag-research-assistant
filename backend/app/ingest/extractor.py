import io
import shutil
import subprocess
import tempfile
from pathlib import Path

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md"}


def normalize_extension(filename: str) -> str:
    return Path(filename).suffix.lower()


def _decode_text(data: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _extract_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise RuntimeError("PDF extraction requires 'pypdf' to be installed on the backend.") from exc

    reader = PdfReader(io.BytesIO(data))
    if getattr(reader, "is_encrypted", False):
        try:
            reader.decrypt("")
        except Exception as exc:
            raise ValueError("Encrypted PDFs cannot be processed. Please upload an unencrypted PDF.") from exc

    pages: list[str] = []
    for page in reader.pages:
        extracted = (page.extract_text() or "").strip()
        if extracted:
            pages.append(extracted)
    text = "\n\n".join(pages).strip()
    if not text:
        raise ValueError("No selectable text could be extracted from this PDF (it may be scanned images only).")
    return text


def _extract_docx(data: bytes) -> str:
    try:
        from docx import Document
    except ImportError as exc:
        raise RuntimeError("DOCX extraction requires 'python-docx' to be installed on the backend.") from exc

    doc = Document(io.BytesIO(data))
    parts: list[str] = []
    for para in doc.paragraphs:
        txt = para.text.strip()
        if txt:
            parts.append(txt)
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                parts.append(" | ".join(cells))
    text = "\n\n".join(parts).strip()
    if not text:
        raise ValueError("The Word (.docx) document appears to contain no extractable text.")
    return text


def _extract_doc(data: bytes) -> str:
    # Legacy binary .doc requires an external converter (antiword or LibreOffice soffice)
    antiword = shutil.which("antiword")
    if antiword:
        with tempfile.NamedTemporaryFile(suffix=".doc", delete=True) as tmp:
            tmp.write(data)
            tmp.flush()
            proc = subprocess.run([antiword, tmp.name], capture_output=True, text=True, timeout=30)
            if proc.returncode == 0 and proc.stdout.strip():
                return proc.stdout.strip()

    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if soffice:
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "input.doc"
            src.write_bytes(data)
            proc = subprocess.run(
                [soffice, "--headless", "--convert-to", "txt:Text", "--outdir", tmpdir, str(src)],
                capture_output=True,
                text=True,
                timeout=45,
            )
            txt_file = Path(tmpdir) / "input.txt"
            if proc.returncode == 0 and txt_file.exists():
                content = txt_file.read_text(encoding="utf-8", errors="replace").strip()
                if content:
                    return content

    raise ValueError(
        "Legacy binary .doc files require antiword or LibreOffice on the server. "
        "Please convert the file to .docx, .pdf, .txt, or .md."
    )


def extract_text(filename: str, data: bytes) -> str:
    ext = normalize_extension(filename)
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file format '{ext or 'unknown'}'. Supported formats: .pdf, .docx, .doc, .txt, .md.")
    if not data:
        raise ValueError("Uploaded file is empty.")

    if ext in {".txt", ".md"}:
        text = _decode_text(data).strip()
        if not text:
            raise ValueError("The uploaded text file is empty.")
        return text
    if ext == ".pdf":
        return _extract_pdf(data)
    if ext == ".docx":
        return _extract_docx(data)
    return _extract_doc(data)
