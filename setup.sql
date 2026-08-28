-- RecoverAI Database Schema

-- Cases Directory Table
CREATE TABLE IF NOT EXISTS cases (
    id VARCHAR(50) PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    amount DECIMAL(10, 2) NOT NULL,
    type VARCHAR(50) NOT NULL, -- payment_failed, checkout_abandoned, receivables
    failure_reason VARCHAR(100) NOT NULL, -- insufficient_funds, expired_card, etc.
    timezone VARCHAR(50) NOT NULL,
    intent_score INTEGER DEFAULT 50,
    has_support_ticket BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'ingested', -- ingested, recovering, recovered, failed, suppressed
    current_step_index INTEGER DEFAULT 0,
    has_coupon BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Interventions Event Log Sequence Table
CREATE TABLE IF NOT EXISTS case_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id VARCHAR(50) NOT NULL,
    timestamp VARCHAR(50) NOT NULL,
    level VARCHAR(50) NOT NULL, -- INGEST, DIAGNOSE, GUARDRAIL, ACTION, SUCCESS, FAIL
    title VARCHAR(150) NOT NULL,
    description TEXT,
    channel VARCHAR(50), -- card_retry, email, sms, voice, manual
    bubble TEXT, -- Personalized message text body or conversation logs
    is_voice BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- Compliance blacklist suppressions table
CREATE TABLE IF NOT EXISTS blacklists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    value VARCHAR(100) NOT NULL UNIQUE, -- Domain or email address
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Decision Matrix conditional rule overrides table
CREATE TABLE IF NOT EXISTS decision_rules (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    criterion VARCHAR(200) NOT NULL,
    action VARCHAR(50) NOT NULL, -- force_human, bypass_retry, apply_coupon, suppress
    description TEXT,
    active BOOLEAN DEFAULT TRUE
);

-- Playbook configuration stages table
CREATE TABLE IF NOT EXISTS playbooks (
    id VARCHAR(50) PRIMARY KEY, -- saas_fail, checkout_drop, b2b_collect, hinglish_voice
    steps TEXT NOT NULL, -- comma separated steps (e.g. "retry_api,email_reminder,sms_alert")
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
