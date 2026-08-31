from typing import Any

from app.schemas import RevenueEventIn


def _money(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    return float(value)


def normalize_stripe_payment_failed(payload: dict[str, Any]) -> RevenueEventIn:
    customer_id = payload.get("customer") or payload.get("customer_id")
    amount_cents = payload.get("amount") or payload.get("amount_cents") or 0
    failure_code = payload.get("failure_code") or payload.get("raw_reason_code") or "issuer_soft_decline"
    return RevenueEventIn(
        source="payment",
        customer_id=str(customer_id),
        amount_at_risk=round(_money(amount_cents) / 100, 2),
        currency=str(payload.get("currency", "USD")).upper(),
        raw_reason_code=str(failure_code),
        metadata=dict(payload),
    )


def normalize_checkout_abandoned(payload: dict[str, Any]) -> RevenueEventIn:
    return RevenueEventIn(
        source="checkout",
        customer_id=str(payload.get("customer_id")),
        amount_at_risk=_money(payload.get("cart_total")),
        currency=str(payload.get("currency", "USD")).upper(),
        raw_reason_code=str(payload.get("raw_reason_code", "checkout_timeout")),
        metadata=dict(payload),
    )


def normalize_invoice_overdue(payload: dict[str, Any]) -> RevenueEventIn:
    return RevenueEventIn(
        source="invoice",
        customer_id=str(payload.get("account_id") or payload.get("customer_id")),
        amount_at_risk=_money(payload.get("invoice_amount")),
        currency=str(payload.get("currency", "INR")).upper(),
        raw_reason_code=str(payload.get("raw_reason_code", "invoice_overdue")),
        metadata=dict(payload),
    )


def normalize_subscription_payment_failed(payload: dict[str, Any]) -> RevenueEventIn:
    failure_code = payload.get("failure_code") or payload.get("raw_reason_code") or "subscription_payment_failed"
    return RevenueEventIn(
        source="subscription",
        customer_id=str(payload.get("customer_id")),
        amount_at_risk=_money(payload.get("renewal_amount")),
        currency=str(payload.get("currency", "USD")).upper(),
        raw_reason_code=str(failure_code),
        metadata=dict(payload),
    )


def normalize_mandate_failed(payload: dict[str, Any]) -> RevenueEventIn:
    return RevenueEventIn(
        source="mandate",
        customer_id=str(payload.get("customer_id")),
        amount_at_risk=_money(payload.get("mandate_amount")),
        currency=str(payload.get("currency", "INR")).upper(),
        raw_reason_code=str(payload.get("raw_reason_code", "mandate_failed")),
        metadata=dict(payload),
    )


__all__ = [
    "normalize_stripe_payment_failed",
    "normalize_checkout_abandoned",
    "normalize_invoice_overdue",
    "normalize_subscription_payment_failed",
    "normalize_mandate_failed",
]
