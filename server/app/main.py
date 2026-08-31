from fastapi import FastAPI

from app.config import APP_NAME
from app.db import init_db
from app.ingestion.webhooks import router as webhooks_router

app = FastAPI(title=APP_NAME)
app.include_router(webhooks_router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/")
def health() -> dict[str, str]:
    return {"status": "ok"}
