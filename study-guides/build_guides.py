#!/usr/bin/env python3
"""Generate static, downloadable CT-AI study PDFs from the standalone HTML source.

Each of the seven chapter PDFs must be at most two A4 pages.
The combined booklet contains a short study-map cover followed by all seven chapters.
All content is locally authored; the official ISTQB syllabus remains the authoritative source.
"""
from __future__ import annotations

from pathlib import Path

import fitz
from bs4 import BeautifulSoup
from weasyprint import HTML

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "ct-ai-v2-summaries.html"
OUTPUT = ROOT / "pdfs"
OUTPUT.mkdir(parents=True, exist_ok=True)

soup = BeautifulSoup(SOURCE.read_text(encoding="utf-8"), "html.parser")
assert soup.head is not None and soup.body is not None, "Invalid guide HTML"

def printable_page(section, extra_css=""):
    head = str(soup.head)
    if extra_css:
        head = head.replace("</head>", "<style>" + extra_css + "</style></head>")
    # Browser-specific navigation and PDF buttons live outside the section.
    return '<!doctype html><html lang="ar">' + head + '<body><div class="wrapper">' + str(section) + '</div></body></html>'

def make_pdf(content: str) -> bytes:
    return HTML(string=content, base_url=str(ROOT)).write_pdf()

def pages(pdf: bytes) -> int:
    with fitz.open(stream=pdf, filetype="pdf") as doc:
        return len(doc)

book = fitz.open()
cover = soup.select_one("section.cover")
assert cover is not None, "Missing cover/study map"
cover_pdf = make_pdf(printable_page(cover))
book.insert_pdf(fitz.open(stream=cover_pdf, filetype="pdf"))

for number in range(1, 8):
    chapter = soup.select_one(f"section#chapter-{number}")
    assert chapter is not None, f"Missing chapter {number}"
    page = printable_page(chapter)
    pdf = make_pdf(page)
    if pages(pdf) > 2:
        # Compact-print fallback avoids arbitrary content deletion.
        compact = """
        @page{size:A4;margin:10mm 12mm}
        body{font-size:13px;line-height:1.42}
        .card{padding:10px}
        .chapter li{margin-bottom:5px}
        .concept-map{padding:5px}
        .mind-branch{font-size:9px;min-height:33px}
        """
        pdf = make_pdf(printable_page(chapter, compact))
    count = pages(pdf)
    if count > 2 or count < 1:
        raise RuntimeError(f"Chapter {number} exceeds the two-page maximum: {count}")
    target = OUTPUT / f"CTAI_v2_Chapter_{number}_Summary.pdf"
    target.write_bytes(pdf)
    with fitz.open(stream=pdf, filetype="pdf") as part:
        extract = " ".join(p.get_text() for p in part)
        if f"Chapter {number}" not in extract:
            raise RuntimeError(f"Missing chapter heading in {target.name}")
        book.insert_pdf(part)
    print(f"Verified Chapter {number}: {count} A4 pages · {len(pdf):,} bytes")

combined = OUTPUT / "CTAI_v2_Chapter_Summaries_with_Mind_Maps.pdf"
book.save(combined, garbage=4, deflate=True)
print(f"Verified combined PDF: {len(book)} pages · {combined.stat().st_size:,} bytes")
book.close()
