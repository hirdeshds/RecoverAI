const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config();

const { verifyWebhookSignature, parseWebhookPayload, isDuplicateEvent } = require('./webhook');
const { computeMetrics } = require('./metrics');
const { seedDatabase } = require('../db/seed');

const app = express();
const PORT = process.env.PORT || 5000;
const dbPath = path.join(__dirname, '..', 'recoverai.db');
const db = new Database(dbPath);

app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/health', (req, res) => {
    res.json({ status: 'online', system: 'RecoverAI Express Backend' });
});

app.post('/webhooks/razorpay', (req, res) => {
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-razorpay-signature'];

    if (!verifyWebhookSignature(rawBody, signature)) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const eventId = (req.body.account_id || '') + (req.body.created_at || '');
    if (isDuplicateEvent(eventId)) {
        return res.json({ status: 'ignored', reason: 'duplicate' });
    }

    const parsedRecord = parseWebhookPayload(req.body);

    const insert = db.prepare(`
        INSERT INTO revenue_at_risk 
        (id, customer_id, event_type, amount, currency, razorpay_entity_id, error_code, error_description, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
        parsedRecord.id,
        parsedRecord.customer_id,
        parsedRecord.event_type,
        parsedRecord.amount,
        parsedRecord.currency,
        parsedRecord.razorpay_entity_id,
        parsedRecord.error_code,
        parsedRecord.error_description,
        parsedRecord.status
    );

    res.json({ status: 'processed', record: parsedRecord });
});

app.get('/api/metrics', (req, res) => {
    try {
        const metrics = computeMetrics(db);
        res.json(metrics);
    } catch (err) {
        res.status(500).json({ error: 'Failed to compute metrics', details: err.message });
    }
});

app.post('/api/seed', (req, res) => {
    try {
        seedDatabase();
        res.json({ status: 'success', message: 'Test events seeded' });
    } catch (err) {
        res.status(500).json({ error: 'Seeding failed', details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`RecoverAI Backend Server running on http://localhost:${PORT}`);
});
