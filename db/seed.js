const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'recoverai.db');
const schemaPath = path.join(__dirname, 'schema.sql');

function seedDatabase() {
    const db = new Database(dbPath);
    
    // Read and execute schema
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);

    console.log('Seeding test events into database...');

    const custId = `cust_${Math.random().toString(36).substring(2, 10)}`;

    const insertCustomer = db.prepare('INSERT OR IGNORE INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)');
    insertCustomer.run(custId, 'Sample Customer', 'sample@example.com', '+919876543210');

    const insertRisk = db.prepare(`
        INSERT INTO revenue_at_risk 
        (id, customer_id, event_type, amount, currency, razorpay_entity_id, error_code, error_description, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const events = [
        [`rar_${Math.random().toString(36).substring(2, 10)}`, custId, 'payment_failed', 1499.00, 'INR', 'pay_test101', 'BAD_REQUEST_PAYMENT_TIMED_OUT', 'Bank timeout', 'open'],
        [`rar_${Math.random().toString(36).substring(2, 10)}`, custId, 'checkout_abandoned', 2999.00, 'INR', 'ord_test102', 'CHECKOUT_DISMISSED', 'Modal closed', 'open'],
        [`rar_${Math.random().toString(36).substring(2, 10)}`, custId, 'sub_halted', 999.00, 'INR', 'sub_test103', 'CARD_EXPIRED', 'Card expired', 'open'],
        [`rar_${Math.random().toString(36).substring(2, 10)}`, custId, 'invoice_overdue', 5000.00, 'INR', 'inv_test104', 'INVOICE_EXPIRED', 'Invoice expired', 'open']
    ];

    for (const ev of events) {
        insertRisk.run(...ev);
    }

    console.log('Database seeded successfully.');
    db.close();
}

if (require.main === module) {
    seedDatabase();
}

module.exports = { seedDatabase };
