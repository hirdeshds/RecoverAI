MAX_ATTEMPTS = 3
COOLDOWN_HOURS = 24
DOLLAR_GATE_THRESHOLD = 50000.0  # Require manual review if > 50,000 INR

def should_stop_intervention(customer_id: str, current_attempts: int, amount: float, is_opted_out: bool) -> tuple[bool, str]:
    """
    Evaluates stopping rules: max attempts, cooldown, customer opt-out, dollar gate threshold.
    Returns (should_stop, reason).
    """
    if is_opted_out:
        return True, "Customer opted out"
    if current_attempts >= MAX_ATTEMPTS:
        return True, f"Exceeded maximum recovery attempts ({MAX_ATTEMPTS})"
    if amount > DOLLAR_GATE_THRESHOLD:
        return True, f"High value transaction exceeds gate threshold ({DOLLAR_GATE_THRESHOLD})"
    return False, ""
