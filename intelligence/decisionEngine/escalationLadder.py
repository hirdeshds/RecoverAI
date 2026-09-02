def get_escalation_tier(days_overdue: int) -> dict:
    """
    Escalation Ladder Logic:
    - Day 0-3: Friendly Nudge / Instant Retry
    - Day 4-14: Urgent Reminder + Direct Payment Link
    - Day 15-30: Discount Offer / Alternative Method
    - Day 30+: Account Pause Warning / Escalation to Support
    """
    if days_overdue <= 3:
        return {
            "tier": "day_0_3",
            "tone": "friendly",
            "urgency": "low",
            "recommended_channel": "whatsapp"
        }
    elif days_overdue <= 14:
        return {
            "tier": "day_4_14",
            "tone": "firm",
            "urgency": "medium",
            "recommended_channel": "email"
        }
    elif days_overdue <= 30:
        return {
            "tier": "day_15_30",
            "tone": "urgent",
            "urgency": "high",
            "recommended_channel": "sms"
        }
    else:
        return {
            "tier": "day_30_plus",
            "tone": "final_notice",
            "urgency": "critical",
            "recommended_channel": "email"
        }
