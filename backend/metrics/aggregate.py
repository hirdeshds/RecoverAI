def compute_aggregate_metrics(db_cursor) -> dict:
    """
    Computes dashboard recovery metrics:
    - Total Revenue at Risk
    - Recovered Revenue
    - Recovery Rate (%)
    - Active Interventions
    """
    db_cursor.execute("SELECT SUM(amount) FROM revenue_at_risk")
    total_risk = db_cursor.fetchone()[0] or 0.0

    db_cursor.execute("SELECT SUM(amount) FROM revenue_at_risk WHERE status = 'recovered'")
    total_recovered = db_cursor.fetchone()[0] or 0.0

    db_cursor.execute("SELECT COUNT(*) FROM interventions WHERE status = 'pending'")
    active_interventions = db_cursor.fetchone()[0] or 0

    recovery_rate = (total_recovered / total_risk * 100) if total_risk > 0 else 0.0

    return {
        "total_revenue_at_risk": total_risk,
        "recovered_revenue": total_recovered,
        "recovery_rate_percent": round(recovery_rate, 2),
        "active_interventions": active_interventions
    }
