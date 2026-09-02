import os

def classify_by_llm(error_code: str, error_description: str, failure_context: dict) -> dict:
    """
    Fallback classifier for ambiguous cases, assigning root cause and confidence score.
    """
    # Fallback heuristic / mock LLM response when LLM API key isn't provided
    desc_lower = error_description.lower()
    
    if "timeout" in desc_lower or "time out" in desc_lower:
        root_cause = "bank_timeout"
        confidence = 0.85
    elif "card" in desc_lower or "expired" in desc_lower:
        root_cause = "card_expired"
        confidence = 0.90
    elif "closed" in desc_lower or "abandoned" in desc_lower:
        root_cause = "user_abandoned"
        confidence = 0.80
    else:
        root_cause = "unknown_technical_issue"
        confidence = 0.50

    return {
        "root_cause": root_cause,
        "classifier_type": "llm",
        "confidence_score": confidence,
        "reasoning": f"LLM classification based on context: '{error_description}'"
    }
