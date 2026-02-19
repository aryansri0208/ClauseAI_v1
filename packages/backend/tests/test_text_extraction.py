"""
Tests for text extraction module.
"""

import pytest
import io
from app.text_extraction import (
    extract_and_clean_contract_text,
    extract_text_from_html,
    extract_text_from_pdf,
    clean_text,
    normalize_text,
    ContentType
)


def test_extract_html():
    """Test HTML text extraction."""
    html = """
    <html>
        <head><title>Terms of Service</title></head>
        <body>
            <h1>Terms of Service</h1>
            <p>This is the content.</p>
            <script>console.log('ignore');</script>
        </body>
    </html>
    """
    
    text = extract_text_from_html(html)
    assert "Terms of Service" in text
    assert "This is the content" in text
    assert "console.log" not in text
    assert "<script>" not in text


def test_clean_text():
    """Test text cleaning."""
    dirty_text = "This   has    multiple    spaces.\n\n\n\nAnd   many   newlines."
    cleaned = clean_text(dirty_text)
    
    assert "  " not in cleaned  # No double spaces
    assert "\n\n\n\n" not in cleaned  # No excessive newlines
    assert cleaned.count("\n\n") <= 1  # At most one paragraph break


def test_normalize_text():
    """Test text normalization."""
    text = "Sentence one.Sentence two."
    normalized = normalize_text(text)
    
    assert "Sentence one. Sentence two" in normalized or "Sentence one. Sentence two." in normalized


def test_extract_and_clean_html():
    """Test full extraction and cleaning from HTML."""
    html = """
    <html>
        <body>
            <h1>Contract Terms</h1>
            <p>   This   is   a   contract   with   extra   spaces.   </p>
        </body>
    </html>
    """
    
    result = extract_and_clean_contract_text(html, content_type=ContentType.HTML)
    
    assert "Contract Terms" in result
    assert "  " not in result  # No double spaces
    assert result.strip() == result  # No leading/trailing whitespace


def test_extract_and_clean_auto_detect_html():
    """Test auto-detection for HTML."""
    html = "<html><body><p>Content</p></body></html>"
    
    result = extract_and_clean_contract_text(html, auto_detect=True)
    assert "Content" in result


def test_clean_text_removes_non_printable():
    """Test that non-printable characters are removed."""
    text = "Normal text\u200b\u200c\u200d\ufeffhidden chars"
    cleaned = clean_text(text)
    
    assert "\u200b" not in cleaned
    assert "\u200c" not in cleaned
    assert "\u200d" not in cleaned
    assert "\ufeff" not in cleaned
    assert "Normal text" in cleaned


def test_empty_input():
    """Test handling of empty input."""
    assert extract_and_clean_contract_text("") == ""
    assert extract_and_clean_contract_text("   ") == ""


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
