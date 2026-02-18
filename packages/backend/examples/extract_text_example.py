"""
Example usage of contract text extraction.
"""

from app.text_extraction import extract_and_clean_contract_text, ContentType


def example_html_extraction():
    """Example: Extract text from HTML."""
    html_content = """
    <html>
        <head><title>Terms of Service</title></head>
        <body>
            <h1>Terms of Service</h1>
            <p>These are the terms and conditions that govern your use of our service.</p>
            <p>By using our service, you agree to these terms.</p>
            <script>console.log('This will be removed');</script>
        </body>
    </html>
    """
    
    cleaned_text = extract_and_clean_contract_text(
        html_content,
        content_type=ContentType.HTML
    )
    
    print("Extracted HTML text:")
    print(cleaned_text)
    print("\n" + "="*50 + "\n")


def example_pdf_extraction():
    """Example: Extract text from PDF."""
    # Read PDF file
    pdf_path = "contract.pdf"  # Replace with actual PDF path
    
    try:
        with open(pdf_path, 'rb') as f:
            pdf_bytes = f.read()
        
        cleaned_text = extract_and_clean_contract_text(
            pdf_bytes,
            content_type=ContentType.PDF
        )
        
        print("Extracted PDF text:")
        print(cleaned_text[:500])  # Print first 500 chars
        print("\n" + "="*50 + "\n")
        
    except FileNotFoundError:
        print(f"PDF file not found: {pdf_path}")
        print("Please provide a valid PDF file path.\n")


def example_auto_detect():
    """Example: Auto-detect content type."""
    # HTML example
    html = "<html><body><p>Some content</p></body></html>"
    text = extract_and_clean_contract_text(html, auto_detect=True)
    print("Auto-detected HTML:", text)
    
    # PDF example (if you have a PDF)
    # with open('contract.pdf', 'rb') as f:
    #     pdf_bytes = f.read()
    # text = extract_and_clean_contract_text(pdf_bytes, auto_detect=True)
    # print("Auto-detected PDF:", text[:200])


def example_text_cleaning():
    """Example: Show text cleaning."""
    dirty_text = """
    This   text   has   many   spaces.
    
    
    And   multiple   newlines.
    
    Also   has   tabs	here.
    """
    
    from app.text_extraction import clean_text, normalize_text
    
    cleaned = clean_text(dirty_text)
    normalized = normalize_text(cleaned)
    
    print("Original:")
    print(repr(dirty_text))
    print("\nCleaned:")
    print(repr(cleaned))
    print("\nNormalized:")
    print(repr(normalized))


if __name__ == "__main__":
    print("Contract Text Extraction Examples\n")
    print("="*50 + "\n")
    
    example_html_extraction()
    example_text_cleaning()
    example_auto_detect()
    
    # Uncomment to test PDF extraction:
    # example_pdf_extraction()
