import csv
from io import StringIO
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func

from server.models import (
    Base, get_db, init_db,
    Case, CaseEvent, BlacklistItem, DecisionRule, PlaybookConfig,
    RevenueEventRequest, CaseResponse, BlacklistRequest, BlacklistResponse,
    DecisionRuleRequest, DecisionRuleResponse, PlaybookUpdateRequest, PlaybookResponse
)
from server.agent import RecoveryAgent

app = FastAPI(title="RecoverAI Revenue Autopilot Server")

# Configure CORS so local dashboard can call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    # Initialize DB tables on startup
    init_db()
    # Seed default playbooks and override rules if empty
    db = next(get_db())
    seed_default_configs(db)

def seed_default_configs(db: Session):
    # Seed Playbooks
    defaults = {
        "saas_fail": "retry_api,email_reminder,sms_alert,voice_recovery,escalate_human",
        "checkout_drop": "email_reminder,sms_alert,escalate_human",
        "b2b_collect": "email_reminder,sms_alert,voice_recovery,escalate_human",
        "hinglish_voice": "retry_api,email_reminder,hinglish_voice,escalate_human"
    }
    for k, v in defaults.items():
        if not db.query(PlaybookConfig).filter(PlaybookConfig.id == k).first():
            pb = PlaybookConfig(id=k, steps=v)
            db.add(pb)
    
    # Seed Decision Rules Override Matrix
    rules = [
        ("rule_1", "High-Value Enterprise bypass", "amount > 5000", "force_human", "If amount exceeds $5k, skip automatic bots and direct to human chasers."),
        ("rule_2", "Expired Card redirect", "reason == 'expired_card'", "bypass_retry", "If card expired, skip card retries and shoot link email immediately."),
        ("rule_3", "High Intent drop coupon", "type == 'checkout_abandoned' and intent > 60", "apply_coupon", "If cart drop shows >60 intent, apply 10% coupon to chaser sms."),
        ("rule_4", "Active billing dispute hold", "reason == 'billing_dispute'", "suppress", "If active dispute ticket exists, hold automatic Dunnings.")
    ]
    for r_id, name, crit, act, desc in rules:
        if not db.query(DecisionRule).filter(DecisionRule.id == r_id).first():
            rule = DecisionRule(id=r_id, name=name, criterion=crit, action=act, description=desc, active=True)
            db.add(rule)
            
    db.commit()

# ── API ENDPOINTS ──

@app.post("/api/events", response_model=CaseResponse)
def ingest_event(req: RevenueEventRequest, db: Session = Depends(get_db)):
    """
    Ingest failed payment, checkout abandonment or overdue invoice events.
    """
    existing = db.query(Case).filter(Case.id == req.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Case with this transaction ID already exists.")
    
    case = Case(
        id=req.id,
        customer_name=req.customer_name,
        email=req.email,
        phone=req.phone,
        amount=req.amount,
        type=req.type,
        failure_reason=req.failure_reason,
        timezone=req.timezone,
        intent_score=req.intent_score,
        has_support_ticket=req.has_support_ticket,
        status="ingested",
        current_step_index=0
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    
    # Run initial state transition tick (ingestion + diagnostics)
    RecoveryAgent.step_case(case, db)
    return case

@app.get("/api/cases", response_model=List[CaseResponse])
def get_cases(
    status: Optional[str] = None,
    scenario: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(Case)
    if status:
        if status == "recovering":
            query = query.filter(Case.status.in_(["ingested", "diagnosed", "action_pending", "action_sent", "recovering"]))
        else:
            query = query.filter(Case.status == status)
    if scenario:
        query = query.filter(Case.type == scenario)
    if search:
        query = query.filter(
            Case.customer_name.ilike(f"%{search}%") | 
            Case.id.ilike(f"%{search}%") |
            Case.email.ilike(f"%{search}%")
        )
    return query.order_by(Case.created_at.desc()).offset(offset).limit(limit).all()

@app.get("/api/cases/{case_id}", response_model=CaseResponse)
def get_case_details(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    return case

@app.post("/api/cases/{case_id}/override", response_model=CaseResponse)
def override_case_step(case_id: str, step_index: int, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    
    case.current_step_index = step_index
    case.status = "recovering"
    db.commit()
    
    RecoveryAgent.add_event(db, case.id, "GUARDRAIL", "Manual Playbook Override", f"Operator adjusted case playbook node to step index #{step_index}.")
    RecoveryAgent.step_case(case, db)
    return case

# ── Compliance blacklist routes ──

@app.get("/api/compliance/blacklist", response_model=List[BlacklistResponse])
def get_blacklist(db: Session = Depends(get_db)):
    return db.query(BlacklistItem).all()

@app.post("/api/compliance/blacklist", response_model=BlacklistResponse)
def add_blacklist(req: BlacklistRequest, db: Session = Depends(get_db)):
    existing = db.query(BlacklistItem).filter(BlacklistItem.value == req.value.lower()).first()
    if existing:
        return existing
    item = BlacklistItem(value=req.value.lower())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.delete("/api/compliance/blacklist")
def remove_blacklist(value: str, db: Session = Depends(get_db)):
    item = db.query(BlacklistItem).filter(BlacklistItem.value == value.lower()).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not in blacklist suppression list.")
    db.delete(item)
    db.commit()
    return {"status": "ok"}

# ── Playbook configuration routes ──

@app.get("/api/playbooks")
def get_playbooks(db: Session = Depends(get_db)):
    configs = db.query(PlaybookConfig).all()
    return {c.id: [s.strip() for s in c.steps.split(",") if s.strip()] for c in configs}

@app.post("/api/playbooks/{pb_id}")
def update_playbook(pb_id: str, req: PlaybookUpdateRequest, db: Session = Depends(get_db)):
    pb = db.query(PlaybookConfig).filter(PlaybookConfig.id == pb_id).first()
    steps_str = ",".join(req.steps)
    if pb:
        pb.steps = steps_str
    else:
        pb = PlaybookConfig(id=pb_id, steps=steps_str)
        db.add(pb)
    db.commit()
    return {"status": "ok"}

# ── Rules Override Matrix Routes ──

@app.get("/api/rules", response_model=List[DecisionRuleResponse])
def get_rules(db: Session = Depends(get_db)):
    return db.query(DecisionRule).all()

@app.post("/api/rules", response_model=DecisionRuleResponse)
def update_rule(req: DecisionRuleRequest, db: Session = Depends(get_db)):
    rule = db.query(DecisionRule).filter(DecisionRule.id == req.id).first()
    if rule:
        rule.name = req.name
        rule.criterion = req.criterion
        rule.action = req.action
        rule.description = req.description
        rule.active = req.active
    else:
        rule = DecisionRule(id=req.id, name=req.name, criterion=req.criterion, action=req.action, description=req.description, active=req.active)
        db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule

# ── Dashboard Statistics telemetry ──

@app.get("/api/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    cases = db.query(Case).all()
    total_risk = sum(c.amount for c in cases)
    recovered_sum = sum(c.amount for c in cases if c.status == "recovered")
    
    # Calculate recovery rate based on closed cases
    recovered_count = sum(1 for c in cases if c.status == "recovered")
    failed_count = sum(1 for c in cases if c.status == "failed")
    total_closed = recovered_count + failed_count
    rate = (recovered_count / total_closed * 100) if total_closed > 0 else 0
    
    active_count = sum(1 for c in cases if c.status in ["ingested", "recovering", "action_pending", "action_sent"])
    suppressed_count = sum(1 for c in cases if c.status == "suppressed")

    # Success channels metrics
    channels = {"card_retry": 0, "email": 0, "sms": 0, "voice": 0, "manual": 0}
    # Count transitions of recovered cases
    for case in cases:
        if case.status == "recovered":
            # Match channel of last Action event
            last_action = db.query(CaseEvent).filter(
                (CaseEvent.case_id == case.id) & (CaseEvent.level == "ACTION")
            ).order_by(CaseEvent.id.desc()).first()
            if last_action and last_action.channel in channels:
                channels[last_action.channel] += 1
            else:
                channels["manual"] += 1

    return {
        "kpis": {
            "recovered": float(recovered_sum),
            "at_risk": float(total_risk),
            "active": active_count,
            "rate": round(rate, 1),
            "suppressed": suppressed_count
        },
        "funnels": {
            "ingested": len(cases),
            "diagnosed": sum(1 for c in cases if c.status != "ingested"),
            "notified": sum(1 for c in cases if c.current_step_index > 0 or c.status in ["recovered", "failed"]),
            "recovered": recovered_count,
            "failed": failed_count
        },
        "channels": channels
    }

@app.get("/api/dashboard/logs")
def get_dashboard_logs(limit: int = 50, db: Session = Depends(get_db)):
    events = db.query(CaseEvent).order_by(CaseEvent.id.desc()).limit(limit).all()
    return [
        {
            "id": e.id,
            "case_id": e.case_id,
            "timestamp": e.timestamp,
            "level": e.level,
            "title": e.title,
            "message": e.description
        } for e in events
    ]

# ── Batch Simulation Runner ──

@app.post("/api/simulation/run")
def trigger_simulation(scenario: str, size: int = 30, offset_hours: int = 0, db: Session = Depends(get_db)):
    """
    Generates a batch of synthetic recovery transaction cases, pushes them to the DB,
    and runs them to termination (recovered, failed, suppressed) step-by-step
    simulating a real production batch execution.
    """
    first_names = ["Arjun", "Priya", "Vikram", "Meera", "Rahul", "Ananya", "Amit", "Sneha", "Rohan", "Komal", "John", "Sarah", "Emma", "David"]
    last_names = ["Sharma", "Verma", "Gupta", "Sen", "Mehta", "Singh", "Patel", "Smith", "Jones", "Brown"]
    saas_reasons = ["insufficient_funds", "expired_card", "card_declined"]
    b2b_reasons = ["invoice_30d_overdue", "invoice_60d_overdue", "billing_dispute"]
    timezones = ["America/New_York", "US/Pacific", "Europe/London", "Asia/Kolkata", "Asia/Tokyo"]

    new_cases = []
    for i in range(1, size + 1):
        case_id = f"REC-SIM-{i}-{int(func.random() * 1000)}"
        name = f"{random.choice(first_names)} {random.choice(last_names)}"
        
        # 15% suppression blacklist probability
        email = f"{name.lower().replace(' ', '.')}@"
        email += "baddebt@scam.com" if random.random() > 0.85 else f"company{i}.com"
        
        phone = f"+91 {random.randint(8000000000, 9999999999)}"
        tz = random.choice(timezones)
        intent = random.randint(20, 95)
        
        type_str = "payment_failed"
        reason_str = "insufficient_funds"
        amount = 49.0

        if scenario == "saas_fail":
            type_str = "payment_failed"
            reason_str = random.choice(saas_reasons)
            amount = 999.0 if random.random() > 0.8 else (149.0 if random.random() > 0.5 else 49.0)
        elif scenario == "checkout_drop":
            type_str = "checkout_abandoned"
            reason_str = "abandoned_cart"
            amount = float(random.randint(80, 1500))
        elif scenario == "b2b_collect":
            type_str = "receivables"
            reason_str = random.choice(b2b_reasons)
            amount = float(random.randint(2500, 20000))
        elif scenario == "hinglish_voice":
            type_str = "payment_failed"
            reason_str = random.choice(saas_reasons)
            amount = float(random.randint(100, 2500))

        dispute = (reason_str == "billing_dispute") or (random.random() > 0.95)

        case = Case(
            id=case_id,
            customer_name=name,
            email=email,
            phone=phone,
            amount=amount,
            type=type_str,
            failure_reason=reason_str,
            timezone=tz,
            intent_score=intent,
            has_support_ticket=dispute,
            status="ingested",
            current_step_index=0
        )
        db.add(case)
        new_cases.append(case)

    db.commit()

    # Step through every case until resolved (limit iterations to prevent infinity)
    for _ in range(12):
        active = [c for c in new_cases if c.status in ["ingested", "recovering", "action_pending", "action_sent"]]
        if not active:
            break
        for c in active:
            RecoveryAgent.step_case(c, db, timezone_offset=offset_hours)

    return {"status": "ok", "generated_cases": len(new_cases)}

# ── CSV Ledger Exporter ──

@app.get("/api/export")
def export_cases_csv(db: Session = Depends(get_db)):
    cases = db.query(Case).all()
    output = StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "Case ID", "Customer Name", "Email", "Phone", "Amount At Risk ($)",
        "Scenario Type", "Failure Reason", "Local Timezone", "Recovery Status",
        "Retry Attempts", "Notification Contact Attempts", "Created At"
    ])
    
    for c in cases:
        writer.writerow([
            c.id, c.customer_name, c.email, c.phone or "", float(c.amount),
            c.type, c.failure_reason, c.timezone, c.status,
            c.total_retries, c.contact_attempts, c.created_at.strftime("%Y-%m-%d %H:%M:%S")
        ])
        
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=recoverai_audit_trail_report.csv"}
    )
