const crypto = require('crypto');

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_secret';
const processedEvents = new Set();

function verifyWebhookSignature(bodyString, signature) {
    if (!signature) return false;
    const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(bodyString)
        .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
}

function parseWebhookPayload(payload) {
    const event = payload.event || '';
    const entity = payload.payload?.payment?.entity || {};

    const amount = entity.amount ? entity.amount / 100 : 0.0;
    const currency = entity.currency || 'INR';
    const razorpayEntityId = entity.id || payload.account_id || '';
    const errorCode = entity.error_code || 'UNKNOWN_ERROR';
    const errorDescription = entity.error_description || 'Webhook payload received';
    const customerId = entity.customer_id || 'cust_unknown';

    return {
        id: `rar_${Math.random().toString(36).substring(2, 10)}`,
        customer_id: customerId,
        event_type: event,
        amount,
        currency,
        razorpay_entity_id: razorpayEntityId,
        error_code: errorCode,
        error_description: errorDescription,
        status: 'open'
    };
}

function isDuplicateEvent(eventId) {
    if (processedEvents.has(eventId)) return true;
    processedEvents.add(eventId);
    return false;
}

module.exports = {
    verifyWebhookSignature,
    parseWebhookPayload,
    isDuplicateEvent
};
