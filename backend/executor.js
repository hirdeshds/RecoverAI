const { createPaymentLink, resendInvoice, retrySubscription } = require('./razorpay');

function evaluateStoppingRules(customerId, attempts, amount) {
    if (attempts >= 3) {
        return { stop: true, reason: 'Exceeded max recovery attempts (3)' };
    }
    if (amount > 50000.0) {
        return { stop: true, reason: 'Exceeds high-value manual review threshold (50,000 INR)' };
    }
    return { stop: false, reason: '' };
}

async function runIntervention(intervention) {
    const { action_type, razorpay_entity_id, amount } = intervention;

    try {
        if (action_type === 'send_payment_link') {
            const res = await createPaymentLink(amount || 100, 'INR', 'Revenue Recovery', {});
            return { status: 'executed', result: res };
        } else if (action_type === 'resend_invoice') {
            const res = await resendInvoice(razorpay_entity_id);
            return { status: 'executed', result: res };
        } else if (action_type === 'retry_charge') {
            const res = await retrySubscription(razorpay_entity_id);
            return { status: 'executed', result: res };
        }
    } catch (err) {
        return { status: 'failed', error: err.message };
    }

    return { status: 'skipped', reason: `Unknown action ${action_type}` };
}

module.exports = {
    evaluateStoppingRules,
    runIntervention
};
