from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import APP_NAME, FRONTEND_ORIGINS
from app.db import init_db
from app.ingestion.webhooks import router as webhooks_router

app = FastAPI(title=APP_NAME)
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(webhooks_router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/")
def health() -> dict[str, str]:
    return {"status": "ok"}
