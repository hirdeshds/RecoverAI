# app/orchestrator/diagnose.py
import json
import os
from typing import Any, Dict

# Align exactly with decide.py PLAYBOOKS keys
RULES_MAP = {
    "expired_card": "card_expired",
    "card_expired": "card_expired",
    "insufficient_funds": "insufficient_funds",
    "checkout_timeout": "checkout_price_hesitation",
    "payment_method_unavailable": "checkout_payment_method_gap",
    "invoice_overdue": "invoice_forgotten",
    "disputed_invoice": "invoice_disputed",
    "subscription_payment_failed": "insufficient_funds",
    "mandate_failed": "mandate_expired",
}

ROOT_CAUSE_ENUM = [
    "card_expired",
    "insufficient_funds",
    "issuer_soft_decline",
    "checkout_price_hesitation",
    "checkout_payment_method_gap",
    "invoice_forgotten",
    "invoice_disputed",
    "mandate_expired",
    "other"
]

CLASSIFY_TOOL = {
    "name": "classify_root_cause",
    "description": "Classifies the failure reason into a standardized root cause enum.",
    "input_schema": {
        "type": "object",
        "properties": {
            "root_cause": {
                "type": "string",
                "enum": ROOT_CAUSE_ENUM,
                "description": "Standardized recovery root cause."
            },
            "confidence": {
                "type": "number",
                "description": "Confidence score between 0.0 and 1.0"
            }
        },
        "required": ["root_cause", "confidence"]
    }
}

def diagnose(raw_reason_code: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
    context = context or {}
    clean_code = (raw_reason_code or "").strip().lower()

    # 1. Tier 1: Fast deterministic rules
    if clean_code in RULES_MAP:
        return {
            "root_cause": RULES_MAP[clean_code],
            "confidence": 1.0,
            "method": "rules_prefilter"
        }

    # 2. Tier 2: Anthropic Claude tool-calling fallback
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return {"root_cause": "other", "confidence": 0.0, "method": "llm_missing_key_fallback"}

    try:
        from anthropic import Anthropic

        client = Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-3-7-sonnet-20250219",
            max_tokens=256,
            tools=[CLASSIFY_TOOL],
            tool_choice={"type": "tool", "name": "classify_root_cause"},
            messages=[
                {
                    "role": "user",
                    "content": f"Classify this revenue failure code: '{raw_reason_code}'. Extra context: {json.dumps(context)}"
                }
            ]
        )

        for block in response.content:
            if block.type == "tool_use" and block.name == "classify_root_cause":
                return {
                    "root_cause": block.input.get("root_cause", "other"),
                    "confidence": float(block.input.get("confidence", 0.8)),
                    "method": "llm_tool_call"
                }

    except Exception as exc:
        # Defensive catch: return fallback to protect worker loop
        return {
            "root_cause": "other",
            "confidence": 0.0,
            "method": "llm_error_fallback",
            "error": str(exc)
        }

    return {"root_cause": "other", "confidence": 0.0, "method": "fallback"}
