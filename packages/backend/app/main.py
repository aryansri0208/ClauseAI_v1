from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from app.text_extraction import (
    extract_and_clean_contract_text,
    extract_and_clean_contract_text_from_url,
    ExtractFromURLError,
    ContentType,
)

app = FastAPI(title="ClauseAI API")


class URLRequest(BaseModel):
    url: str
    content_type: Optional[str] = None


@app.get("/")
def root():
    return {"status": "ClauseAI backend running"}


@app.post("/api/extract-text")
async def extract_text(
    content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    content_type: Optional[str] = Form(None),
):
    """
    Extract and clean contract text from web pages or PDFs.
    Provide `content` (raw HTML/text) or `file` (PDF/HTML upload).
    """
    try:
        if file:
            file_content = await file.read()
            file_extension = (file.filename or "").split(".")[-1].lower()

            if file_extension == "pdf" or content_type == "pdf":
                extracted_text = extract_and_clean_contract_text(
                    file_content, content_type=ContentType.PDF
                )
            elif file_extension in ("html", "htm") or content_type == "html":
                extracted_text = extract_and_clean_contract_text(
                    file_content, content_type=ContentType.HTML
                )
            else:
                extracted_text = extract_and_clean_contract_text(
                    file_content, auto_detect=True
                )
        elif content:
            extracted_text = extract_and_clean_contract_text(
                content,
                content_type=ContentType(content_type) if content_type else None,
                auto_detect=True,
            )
        else:
            return JSONResponse(
                status_code=400,
                content={"error": "Either 'content' or 'file' must be provided"},
            )

        return {
            "success": True,
            "text": extracted_text,
            "length": len(extracted_text),
            "word_count": len(extracted_text.split()),
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)},
        )


@app.post("/api/extract-from-url")
async def extract_from_url(request: URLRequest):
    """
    Extract and clean contract text from a URL (web page or PDF).
    All logic is in app.text_extraction.
    """
    try:
        result = await extract_and_clean_contract_text_from_url(
            url=request.url,
            content_type=request.content_type,
        )
        return result
    except ExtractFromURLError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
