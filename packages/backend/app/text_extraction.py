"""
Contract text extraction and cleaning module.

Handles extraction and normalization of text from:
- Web pages (HTML/DOM)
- PDF documents
- URLs (fetch + extract)
"""

import re
import io
import gzip
from typing import Union, Optional, TypedDict
from enum import Enum


# ---------------------------------------------------------------------------
# URL fetch & extract (entire feature lives here)
# ---------------------------------------------------------------------------

class ExtractFromURLResult(TypedDict):
    success: bool
    url: str
    text: str
    length: int
    word_count: int
    content_type: str


class ExtractFromURLError(Exception):
    """Raised when URL fetch or extraction fails."""
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _default_fetch_headers() -> dict:
    """Browser-like headers to reduce 403s."""
    return {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Cache-Control": "max-age=0",
    }


def _decode_html_content(response) -> str:
    """Decode response body to string, handling compression and encoding."""
    try:
        content = response.text
        if not content:
            content_bytes = response.content
            content = _decode_bytes_to_str(content_bytes)
        else:
            sample = content[:1000]
            non_printable = sum(1 for c in sample if not c.isprintable() and c not in "\n\r\t")
            if non_printable / max(len(sample), 1) > 0.1:
                content = _decode_bytes_to_str(response.content)
        return content
    except Exception:
        return _decode_bytes_to_str(response.content)


def _decode_bytes_to_str(content_bytes: bytes) -> str:
    """Try gzip then encodings to get a string."""
    try:
        return gzip.decompress(content_bytes).decode("utf-8", errors="ignore")
    except Exception:
        pass
    for encoding in ("utf-8", "latin-1", "iso-8859-1"):
        try:
            return content_bytes.decode(encoding)
        except Exception:
            continue
    return content_bytes.decode("utf-8", errors="ignore")


async def extract_and_clean_contract_text_from_url(
    url: str,
    content_type: Optional[str] = None,
) -> ExtractFromURLResult:
    """
    Fetch content from a URL and extract/clean contract text.
    
    All logic for this feature lives here: fetch, decompression, encoding,
    content-type detection, and extraction.
    
    Args:
        url: HTTP(S) URL to fetch.
        content_type: Optional explicit type ('html', 'pdf', 'text').
        
    Returns:
        Dict with success, url, text, length, word_count, content_type.
        
    Raises:
        ExtractFromURLError: On fetch failure (status_code and detail set).
    """
    import httpx
    
    if not url.startswith(("http://", "https://")):
        raise ExtractFromURLError(400, "URL must start with http:// or https://")
    
    headers = _default_fetch_headers()
    
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code
                if status_code == 403:
                    detail = (
                        "Access forbidden (403). The website may be blocking automated requests. "
                        "Try accessing the URL in a browser first."
                    )
                elif status_code == 404:
                    detail = f"URL not found (404): {url}"
                elif status_code == 429:
                    detail = "Too many requests (429). Please try again later."
                else:
                    detail = f"Failed to fetch URL: HTTP {status_code}"
                raise ExtractFromURLError(status_code, detail)
            
            content_type_header = response.headers.get("content-type", "").lower()
            is_pdf = "application/pdf" in content_type_header or url.lower().endswith(".pdf")
            is_html = "text/html" in content_type_header or "application/xhtml" in content_type_header
            
            if is_pdf:
                raw = response.content
                extracted_text = extract_and_clean_contract_text(
                    raw,
                    content_type=ContentType.PDF,
                )
                detected_type = "pdf"
            elif is_html or not content_type:
                html_str = _decode_html_content(response)
                extracted_text = extract_and_clean_contract_text(
                    html_str,
                    content_type=ContentType.HTML if is_html else None,
                    auto_detect=True,
                )
                detected_type = "html" if is_html else "text"
            else:
                if content_type == "text":
                    raw = response.text
                else:
                    raw = response.content
                extracted_text = extract_and_clean_contract_text(
                    raw,
                    content_type=ContentType(content_type),
                    auto_detect=False,
                )
                detected_type = content_type
            
            return {
                "success": True,
                "url": url,
                "text": extracted_text,
                "length": len(extracted_text),
                "word_count": len(extracted_text.split()),
                "content_type": detected_type,
            }
    except httpx.RequestError as e:
        raise ExtractFromURLError(400, f"Failed to fetch URL: {e!s}")


# ---------------------------------------------------------------------------
# Content extraction (HTML, PDF, clean, normalize)
# ---------------------------------------------------------------------------


class ContentType(Enum):
    """Content type enumeration."""
    HTML = "html"
    PDF = "pdf"
    TEXT = "text"


def extract_text_from_html(html_content: str) -> str:
    """
    Extract text content from HTML/DOM.
    
    Args:
        html_content: Raw HTML string
        
    Returns:
        Extracted text content
    """
    try:
        from bs4 import BeautifulSoup
        
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(['script', 'style', 'noscript', 'iframe', 'svg']):
            script.decompose()
        
        # Get text content
        text = soup.get_text(separator=' ', strip=True)
        return text
        
    except ImportError:
        # Fallback: basic regex-based extraction if BeautifulSoup not available
        # Remove script and style tags
        text = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<noscript[^>]*>.*?</noscript>', '', text, flags=re.DOTALL | re.IGNORECASE)
        
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', ' ', text)
        
        # Decode HTML entities (basic)
        text = text.replace('&nbsp;', ' ')
        text = text.replace('&amp;', '&')
        text = text.replace('&lt;', '<')
        text = text.replace('&gt;', '>')
        text = text.replace('&quot;', '"')
        text = text.replace('&#39;', "'")
        
        return text


def extract_text_from_pdf(pdf_content: Union[bytes, str, io.BytesIO]) -> str:
    """
    Extract text content from PDF.
    
    Args:
        pdf_content: PDF content as bytes, file path, or BytesIO object
        
    Returns:
        Extracted text content
    """
    try:
        import pdfplumber
        
        # Handle different input types
        if isinstance(pdf_content, str):
            # Assume it's a file path
            with open(pdf_content, 'rb') as f:
                pdf_bytes = f.read()
        elif isinstance(pdf_content, bytes):
            pdf_bytes = pdf_content
        elif isinstance(pdf_content, io.BytesIO):
            pdf_bytes = pdf_content.read()
        else:
            raise ValueError(f"Unsupported PDF input type: {type(pdf_content)}")
        
        text_parts = []
        
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        
        return '\n'.join(text_parts)
        
    except ImportError:
        # Fallback to PyPDF2 if pdfplumber not available
        try:
            import PyPDF2
            
            if isinstance(pdf_content, str):
                with open(pdf_content, 'rb') as f:
                    pdf_bytes = f.read()
            elif isinstance(pdf_content, bytes):
                pdf_bytes = pdf_content
            elif isinstance(pdf_content, io.BytesIO):
                pdf_bytes = pdf_content.read()
            else:
                raise ValueError(f"Unsupported PDF input type: {type(pdf_content)}")
            
            pdf_file = io.BytesIO(pdf_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            text_parts = []
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            
            return '\n'.join(text_parts)
            
        except ImportError:
            raise ImportError(
                "No PDF parsing library available. Please install 'pdfplumber' or 'PyPDF2': "
                "pip install pdfplumber"
            )


def clean_text(text: str) -> str:
    """
    Clean extracted text by removing unnecessary characters and normalizing.
    
    Args:
        text: Raw extracted text
        
    Returns:
        Cleaned and normalized text
    """
    if not text:
        return ""
    
    # Remove non-printable characters (keep tabs, newlines, carriage returns for now)
    text = ''.join(char for char in text if char.isprintable() or char in '\n\r\t')
    
    # Normalize whitespace: replace multiple spaces with single space
    text = re.sub(r' +', ' ', text)
    
    # Normalize line breaks: replace multiple newlines with double newline (paragraph break)
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Normalize tabs: replace tabs with spaces
    text = text.replace('\t', ' ')
    
    # Remove leading/trailing whitespace from each line
    lines = [line.strip() for line in text.split('\n')]
    text = '\n'.join(lines)
    
    # Remove empty lines (but keep paragraph breaks)
    text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
    
    # Remove excessive spaces around punctuation
    text = re.sub(r'\s+([.,;:!?])', r'\1', text)
    text = re.sub(r'([.,;:!?])\s+', r'\1 ', text)
    
    # Normalize quotes
    text = text.replace('"', '"').replace('"', '"')
    text = text.replace(''', "'").replace(''', "'")
    
    # Remove zero-width characters
    text = re.sub(r'[\u200b-\u200d\ufeff]', '', text)
    
    # Final cleanup: remove any remaining excessive whitespace
    text = re.sub(r' {2,}', ' ', text)
    
    return text.strip()


def normalize_text(text: str) -> str:
    """
    Normalize text formatting for consistency.
    
    Args:
        text: Cleaned text
        
    Returns:
        Normalized text
    """
    if not text:
        return ""
    
    # Ensure consistent line breaks (Unix-style)
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    
    # Normalize paragraph spacing (exactly two newlines between paragraphs)
    text = re.sub(r'\n{2,}', '\n\n', text)
    
    # Ensure sentences end with proper spacing
    text = re.sub(r'([.!?])([A-Z])', r'\1 \2', text)
    
    # Remove spaces at start/end of lines
    lines = [line.strip() for line in text.split('\n')]
    text = '\n'.join(lines)
    
    return text.strip()


def extract_and_clean_contract_text(
    content: Union[str, bytes, io.BytesIO],
    content_type: Optional[Union[ContentType, str]] = None,
    auto_detect: bool = True
) -> str:
    """
    Extract and clean contract text from web pages or PDFs.
    
    This is the main function that handles text extraction and cleaning.
    
    Args:
        content: Raw content - HTML string, PDF bytes, file path, or BytesIO
        content_type: Explicit content type ('html', 'pdf', 'text') or ContentType enum
        auto_detect: If True, attempt to auto-detect content type when not specified
        
    Returns:
        Cleaned and normalized text as a single string
        
    Examples:
        >>> # From HTML
        >>> html = "<html><body><h1>Terms</h1><p>Content here</p></body></html>"
        >>> text = extract_and_clean_contract_text(html, content_type='html')
        
        >>> # From PDF bytes
        >>> with open('contract.pdf', 'rb') as f:
        ...     pdf_bytes = f.read()
        >>> text = extract_and_clean_contract_text(pdf_bytes, content_type='pdf')
        
        >>> # Auto-detect (checks for HTML tags or PDF magic bytes)
        >>> text = extract_and_clean_contract_text(content, auto_detect=True)
    """
    if not content:
        return ""
    
    # Determine content type
    if content_type:
        if isinstance(content_type, str):
            content_type = ContentType(content_type.lower())
    elif auto_detect:
        content_type = _detect_content_type(content)
    else:
        raise ValueError("content_type must be specified when auto_detect=False")
    
    # Extract text based on content type
    if content_type == ContentType.HTML:
        if isinstance(content, bytes):
            content = content.decode('utf-8', errors='ignore')
        raw_text = extract_text_from_html(content)
        
    elif content_type == ContentType.PDF:
        raw_text = extract_text_from_pdf(content)
        
    elif content_type == ContentType.TEXT:
        if isinstance(content, bytes):
            raw_text = content.decode('utf-8', errors='ignore')
        else:
            raw_text = str(content)
    else:
        raise ValueError(f"Unsupported content type: {content_type}")
    
    # Clean and normalize
    cleaned_text = clean_text(raw_text)
    normalized_text = normalize_text(cleaned_text)
    
    return normalized_text


def _detect_content_type(content: Union[str, bytes, io.BytesIO]) -> ContentType:
    """
    Auto-detect content type from content.
    
    Args:
        content: Content to analyze
        
    Returns:
        Detected ContentType
    """
    # Handle BytesIO
    if isinstance(content, io.BytesIO):
        position = content.tell()
        content.seek(0)
        peek = content.read(1024)
        content.seek(position)
        content_bytes = peek
    elif isinstance(content, bytes):
        content_bytes = content[:1024]
    else:
        content_str = str(content)[:1024]
        # Check for HTML tags
        if re.search(r'<[a-z][\s>]', content_str, re.IGNORECASE):
            return ContentType.HTML
        return ContentType.TEXT
    
    # Check PDF magic bytes
    if content_bytes.startswith(b'%PDF'):
        return ContentType.PDF
    
    # Try to decode as string and check for HTML
    try:
        content_str = content_bytes.decode('utf-8', errors='ignore')
        if re.search(r'<[a-z][\s>]', content_str, re.IGNORECASE):
            return ContentType.HTML
    except:
        pass
    
    # Default to text
    return ContentType.TEXT
