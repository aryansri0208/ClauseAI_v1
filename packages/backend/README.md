# ClauseAI Backend

FastAPI backend for contract text extraction and analysis.

## Setup

### Option 1: Using the setup script (Recommended)

```bash
cd packages/backend
./scripts/setup.sh
```

### Option 2: Manual setup

1. **Create virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Upgrade pip:**
   ```bash
   pip install --upgrade pip
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

### Troubleshooting SSL Certificate Issues

If you encounter SSL certificate errors, try:

```bash
pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org -r requirements.txt
```

Or upgrade certificates:
```bash
pip install --upgrade certifi
```

## Running the Server

```bash
cd packages/backend

# Option A: Use the run script (activates venv and starts server)
./scripts/run.sh

# Option B: Manual
source venv/bin/activate
uvicorn app.main:app --reload

# Server will be available at http://localhost:8000
# API docs at http://localhost:8000/docs
```

## API Endpoints

### Extract Contract Text

**POST** `/api/extract-text`

Extract and clean contract text from HTML or PDF.

**Request:**
- Form data with `content` (HTML string) or `file` (PDF/HTML file upload)
- Optional `content_type`: `'html'`, `'pdf'`, or `'text'`

**Response:**
```json
{
  "success": true,
  "text": "cleaned contract text...",
  "length": 1234,
  "word_count": 200
}
```

**Example with curl:**
```bash
# HTML content
curl -X POST "http://localhost:8000/api/extract-text" \
  -F "content=<html><body><p>Terms...</p></body></html>" \
  -F "content_type=html"

# PDF file
curl -X POST "http://localhost:8000/api/extract-text" \
  -F "file=@contract.pdf" \
  -F "content_type=pdf"
```

## Text Extraction Module

The `app/text_extraction.py` module provides:

- **HTML/DOM extraction** - Extracts text from web pages
- **PDF extraction** - Extracts text from PDF documents
- **Text cleaning** - Removes unnecessary characters and normalizes whitespace
- **Text normalization** - Standardizes formatting

**Usage:**
```python
from app.text_extraction import extract_and_clean_contract_text, ContentType

# From HTML
text = extract_and_clean_contract_text(html_content, content_type=ContentType.HTML)

# From PDF
with open('contract.pdf', 'rb') as f:
    pdf_bytes = f.read()
text = extract_and_clean_contract_text(pdf_bytes, content_type=ContentType.PDF)

# Auto-detect
text = extract_and_clean_contract_text(content, auto_detect=True)
```

## Testing

```bash
# Run tests
pytest tests/

# Run with coverage
pytest tests/ --cov=app
```

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI application
│   └── text_extraction.py   # Text extraction module
├── scripts/
│   ├── setup.sh             # Create venv and install deps
│   ├── run.sh               # Start dev server
│   └── test_url_example.sh  # Test URL extraction endpoint
├── tests/
│   └── test_text_extraction.py
├── examples/
│   └── extract_text_example.py
├── requirements.txt
└── README.md
```
