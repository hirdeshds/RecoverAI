import os

APP_NAME = os.getenv("APP_NAME", "RecoverAI")
DEBUG = os.getenv("DEBUG", "false").strip().lower() in {"1", "true", "yes", "on"}
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./recoverai.db")
SQLALCHEMY_ECHO = os.getenv("SQLALCHEMY_ECHO", "false").strip().lower() in {"1", "true", "yes", "on"}

__all__ = [
    "APP_NAME",
    "DEBUG",
    "SECRET_KEY",
    "DATABASE_URL",
    "SQLALCHEMY_ECHO",
]
