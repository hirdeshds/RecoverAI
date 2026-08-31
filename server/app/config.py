import os

APP_NAME = os.getenv("APP_NAME", "RecoverAI")
DEBUG = os.getenv("DEBUG", "false").strip().lower() in {"1", "true", "yes", "on"}
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./recoverai.db")
SQLALCHEMY_ECHO = os.getenv("SQLALCHEMY_ECHO", "false").strip().lower() in {"1", "true", "yes", "on"}
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]

MAX_ATTEMPTS_PER_CASE = int(os.getenv("MAX_ATTEMPTS_PER_CASE", "4"))
COOLDOWN_HOURS_SAME_CASE = int(os.getenv("COOLDOWN_HOURS_SAME_CASE", "24"))
COOLDOWN_HOURS_SAME_CUSTOMER = int(os.getenv("COOLDOWN_HOURS_SAME_CUSTOMER", "6"))
QUIET_HOURS_START = int(os.getenv("QUIET_HOURS_START", "21"))
QUIET_HOURS_END = int(os.getenv("QUIET_HOURS_END", "8"))
MAX_INCENTIVE_PCT = float(os.getenv("MAX_INCENTIVE_PCT", "0.05"))
CASE_AUTO_CLOSE_DAYS = int(os.getenv("CASE_AUTO_CLOSE_DAYS", "21"))
DEMO_MODE = os.getenv("DEMO_MODE", "false").strip().lower() in {"1", "true", "yes", "on"}

__all__ = [
    "APP_NAME",
    "DEBUG",
    "SECRET_KEY",
    "DATABASE_URL",
    "SQLALCHEMY_ECHO",
    "FRONTEND_ORIGINS",
    "MAX_ATTEMPTS_PER_CASE",
    "COOLDOWN_HOURS_SAME_CASE",
    "COOLDOWN_HOURS_SAME_CUSTOMER",
    "QUIET_HOURS_START",
    "QUIET_HOURS_END",
    "MAX_INCENTIVE_PCT",
    "CASE_AUTO_CLOSE_DAYS",
    "DEMO_MODE",
]
