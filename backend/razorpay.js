const Razorpay = require('razorpay');

const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key';
const key_secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

const razorpayClient = new Razorpay({ key_id, key_secret });

function fetchPayment(paymentId) {
    return razorpayClient.payments.fetch(paymentId);
}

function createPaymentLink(amount, currency, description, customer) {
    return razorpayClient.paymentLink.create({
        amount: Math.round(amount * 100),
        currency: currency || 'INR',
        description,
        customer,
        notify: { sms: true, email: true }
    });
}

function resendInvoice(invoiceId) {
    return razorpayClient.invoices.notifyBy(invoiceId, 'email');
}

function retrySubscription(subscriptionId) {
    return razorpayClient.subscriptions.fetch(subscriptionId);
}

module.exports = {
    razorpayClient,
    fetchPayment,
    createPaymentLink,
    resendInvoice,
    retrySubscription
};
