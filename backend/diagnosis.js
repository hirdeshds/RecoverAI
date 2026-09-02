const RULE_BUCKETS = {
    'BAD_REQUEST_PAYMENT_TIMED_OUT': 'bank_timeout',
    'GATEWAY_ERROR': 'gateway_downtime',
    'CARD_EXPIRED': 'card_expired',
    'INSUFFICIENT_FUNDS': 'insufficient_balance',
    'CHECKOUT_DISMISSED': 'user_abandoned',
    'INVOICE_EXPIRED': 'invoice_expired'
};

function diagnoseRootCause(errorCode, errorDescription = '') {
    if (RULE_BUCKETS[errorCode]) {
        return {
            root_cause: RULE_BUCKETS[errorCode],
            classifier_type: 'rules',
            confidence_score: 1.0,
            reasoning: `Exact rule match for error code ${errorCode}`
        };
    }

    const descLower = errorDescription.toLowerCase();
    let rootCause = 'unknown_technical_issue';
    
    if (descLower.includes('timeout')) {
        rootCause = 'bank_timeout';
    } else if (descLower.includes('card') || descLower.includes('expired')) {
        rootCause = 'card_expired';
    }

    return {
        root_cause: rootCause,
        classifier_type: 'llm_fallback',
        confidence_score: 0.75,
        reasoning: `Heuristic/LLM analysis for description: '${errorDescription}'`
    };
}

module.exports = { diagnoseRootCause };
