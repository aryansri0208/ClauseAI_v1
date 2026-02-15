from fastapi import FastAPI

app = FastAPI(title="ClauseAI API")

@app.get("/")
def root():
    return {"status": "ClauseAI backend running"}
