APPROVED_TEMPLATES = {
    "payment_link_nudge": (
        "Hi {customer_name}, we noticed your recent payment of {amount} {currency} didn't go through. "
        "You can quickly complete it using this secure link: {payment_link}"
    ),
    "card_update_prompt": (
        "Hi {customer_name}, your subscription renewal failed due to card expiration. "
        "Please update your billing details here to avoid service interruption: {update_link}"
    ),
    "invoice_reminder": (
        "Hello {customer_name}, invoice #{invoice_id} for {amount} {currency} is overdue. "
        "Please complete the payment here: {payment_link}"
    ),
    "final_notice": (
        "Important: Your subscription is set to be paused due to unpaid balance of {amount} {currency}. "
        "Please resolve your balance immediately: {payment_link}"
    )
}

def render_template(template_key: str, context: dict) -> str:
    """Renders a pre-approved message template. Guarded against freeform LLM generation."""
    template = APPROVED_TEMPLATES.get(template_key)
    if not template:
        raise ValueError(f"Template key '{template_key}' is not approved.")
    return template.format(**context)
