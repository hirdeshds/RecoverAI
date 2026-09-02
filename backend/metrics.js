function computeMetrics(db) {
    const totalRiskRow = db.prepare('SELECT SUM(amount) AS total FROM revenue_at_risk').get();
    const totalRecoveredRow = db.prepare("SELECT SUM(amount) AS total FROM revenue_at_risk WHERE status = 'recovered'").get();
    const pendingInterventionsRow = db.prepare("SELECT COUNT(*) AS count FROM interventions WHERE status = 'pending'").get();

    const totalRisk = totalRiskRow?.total || 0.0;
    const totalRecovered = totalRecoveredRow?.total || 0.0;
    const pendingCount = pendingInterventionsRow?.count || 0;

    const recoveryRate = totalRisk > 0 ? (totalRecovered / totalRisk) * 100 : 0.0;

    return {
        total_revenue_at_risk: totalRisk,
        recovered_revenue: totalRecovered,
        recovery_rate_percent: Number(recoveryRate.toFixed(2)),
        pending_interventions: pendingCount
    };
}

module.exports = { computeMetrics };
