from intelligence.diagnosis.rulesClassifier import classify_by_rules

def classify_error(error_code: str, error_description: str = "") -> dict:
    """
    Diagnoses root cause using rules first, and falls back to heuristic/LLM text classification.
    """
    # 1. Try exact rules classification first
    rule_match = classify_by_rules(error_code)
    if rule_match:
        return rule_match

    # 2. Fallback heuristic/LLM analysis on error_description
    desc_lower = (error_description or "").lower()
    root_cause = "unknown_technical_issue"
    confidence = 0.70

    if "timeout" in desc_lower or "bank" in desc_lower:
        root_cause = "bank_timeout"
        confidence = 0.85
    elif "card" in desc_lower or "expired" in desc_lower:
        root_cause = "card_expired"
        confidence = 0.90
    elif "balance" in desc_lower or "fund" in desc_lower:
        root_cause = "insufficient_balance"
        confidence = 0.85
    elif "dismiss" in desc_lower or "closed" in desc_lower:
        root_cause = "user_abandoned"
        confidence = 0.88

    return {
        "root_cause": root_cause,
        "classifier_type": "llm_fallback",
        "confidence_score": confidence,
        "reasoning": f"LLM/heuristic analysis based on description: '{error_description}'"
    }
