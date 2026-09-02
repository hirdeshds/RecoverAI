-- RecoverAI Database Schema (7 Core Tables)

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(32),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Revenue at Risk Table
CREATE TABLE IF NOT EXISTS revenue_at_risk (
    id VARCHAR(64) PRIMARY KEY,
    customer_id VARCHAR(64) REFERENCES customers(id),
    event_type VARCHAR(64) NOT NULL, -- payment_failed, checkout_abandoned, sub_halted, invoice_overdue
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(8) DEFAULT 'INR',
    razorpay_entity_id VARCHAR(64),
    error_code VARCHAR(64),
    error_description TEXT,
    status VARCHAR(32) DEFAULT 'open', -- open, recovering, recovered, lost
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Diagnoses Table
CREATE TABLE IF NOT EXISTS diagnoses (
    id VARCHAR(64) PRIMARY KEY,
    revenue_at_risk_id VARCHAR(64) REFERENCES revenue_at_risk(id),
    root_cause VARCHAR(64) NOT NULL,
    classifier_type VARCHAR(32) NOT NULL, -- rules, llm
    confidence_score DECIMAL(3, 2),
    reasoning TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Interventions Table
CREATE TABLE IF NOT EXISTS interventions (
    id VARCHAR(64) PRIMARY KEY,
    revenue_at_risk_id VARCHAR(64) REFERENCES revenue_at_risk(id),
    diagnosis_id VARCHAR(64) REFERENCES diagnoses(id),
    action_type VARCHAR(64) NOT NULL, -- send_payment_link, resend_invoice, card_update_prompt, retry_charge
    channel VARCHAR(32) NOT NULL, -- whatsapp, email, sms
    status VARCHAR(32) DEFAULT 'pending', -- pending, sent, failed, cancelled
    scheduled_at TIMESTAMP,
    executed_at TIMESTAMP,
    attempt_number INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Promise to Pay Table
CREATE TABLE IF NOT EXISTS promise_to_pay (
    id VARCHAR(64) PRIMARY KEY,
    intervention_id VARCHAR(64) REFERENCES interventions(id),
    promised_date TIMESTAMP NOT NULL,
    status VARCHAR(32) DEFAULT 'pending', -- pending, honored, missed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Suppressions Table (Opt-outs & Guardrails)
CREATE TABLE IF NOT EXISTS suppressions (
    id VARCHAR(64) PRIMARY KEY,
    customer_id VARCHAR(64) REFERENCES customers(id),
    reason VARCHAR(64) NOT NULL, -- opted_out, max_attempts_exceeded, high_value_manual_gate
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
