import os
import sys
import subprocess
import argparse
import uvicorn
from server.models import init_db, SessionLocal, Case, BlacklistItem, DecisionRule, PlaybookConfig
from server.agent import RecoveryAgent

def setup_command():
    print("🚀 Initializing database tables...")
    init_db()
    
    # Seeds default records
    db = SessionLocal()
    try:
        # Seed default blacklists
        blacklists = ["baddebt@scam.com", "spamdomain.org", "refused@competitor.net"]
        for domain in blacklists:
            if not db.query(BlacklistItem).filter(BlacklistItem.value == domain).first():
                item = BlacklistItem(value=domain)
                db.add(item)
                
        # Seed default playbooks
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
        
        # Seed default rules
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
        print("✅ Database successfully set up and seeded with baseline settings.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error during database setup: {e}")
    finally:
        db.close()

def run_command(host, port):
    print(f"🔥 Starting RecoverAI Uvicorn server on http://{host}:{port}...")
    uvicorn.run("server.api:app", host=host, port=port, reload=True)

def test_command():
    print("🧪 Running unit and integration tests via pytest...")
    # Invoke pytest process
    result = subprocess.run([sys.executable, "-m", "pytest", "server/tests.py"], capture_output=False)
    sys.exit(result.returncode)

def seed_command(size):
    print(f"📦 Seeding synthetic transaction dunning cases (size: {size})...")
    # Trigger simulation execution programmatically
    import random
    from server.models import SessionLocal
    db = SessionLocal()
    
    first_names = ["Arjun", "Priya", "Vikram", "Meera", "Rahul", "Ananya", "Amit", "Sneha", "Rohan", "Komal"]
    last_names = ["Sharma", "Verma", "Gupta", "Sen", "Mehta", "Singh", "Patel", "Das"]
    reasons = ["insufficient_funds", "expired_card", "card_declined", "abandoned_cart", "invoice_30d_overdue"]
    scenarios = ["saas_fail", "checkout_drop", "b2b_collect", "hinglish_voice"]
    timezones = ["America/New_York", "US/Pacific", "Europe/London", "Asia/Kolkata"]

    try:
        for i in range(100, 100 + size):
            case_id = f"REC-SEED-{i}"
            name = f"{random.choice(first_names)} {random.choice(last_names)}"
            email = f"{name.lower().replace(' ', '.')}@company.com"
            phone = f"+91 {random.randint(8000000000, 9999999999)}"
            scen = random.choice(scenarios)
            reason = random.choice(reasons)
            
            # Map type
            type_str = "payment_failed"
            if scen == "checkout_drop":
                type_str = "checkout_abandoned"
                reason = "abandoned_cart"
            elif scen == "b2b_collect":
                type_str = "receivables"
                reason = "invoice_30d_overdue"
                
            amount = float(random.randint(15, 3500))
            tz = random.choice(timezones)
            
            case = Case(
                id=case_id,
                customer_name=name,
                email=email,
                phone=phone,
                amount=amount,
                type=type_str,
                failure_reason=reason,
                timezone=tz,
                intent_score=random.randint(30, 90),
                has_support_ticket=(random.random() > 0.95),
                status="ingested",
                current_step_index=0
            )
            db.add(case)
            db.commit()
            
            # Run simulation transitions steps to terminate or progress case states
            steps = random.randint(1, 6)
            for _ in range(steps):
                if case.status in ["recovered", "failed", "suppressed"]:
                    break
                RecoveryAgent.step_case(case, db)
                
        print(f"✅ Seeding completed. Added {size} fully audited cases to DB.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding cases: {e}")
    finally:
        db.close()

def reset_command():
    print("⚠️  Wiping local SQLite database...")
    db_file = "./recoverai.db"
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
            print("🔥 Wiped recoverai.db file.")
        except Exception as e:
            print(f"❌ Error deleting db file: {e}")
    setup_command()

def main():
    parser = argparse.ArgumentParser(description="RecoverAI CLI Management Script")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # setup parser
    subparsers.add_parser("setup", help="Create DB tables and seeds config settings.")
    
    # run parser
    run_parser = subparsers.add_parser("run", help="Start the FastAPI FastAPI server.")
    run_parser.add_argument("--host", default="127.0.0.1", help="Host address.")
    run_parser.add_argument("--port", type=int, default=8000, help="Port binding.")
    
    # test parser
    subparsers.add_parser("test", help="Execute Python unit tests.")
    
    # seed parser
    seed_parser = subparsers.add_parser("seed", help="Seed cases database with synthetic logs.")
    seed_parser.add_argument("--size", type=int, default=30, help="Number of records to generate.")
    
    # reset parser
    subparsers.add_parser("reset", help="Wipes all database records and re-runs setup migrations.")
    
    args = parser.parse_args()
    
    if args.command == "setup":
        setup_command()
    elif args.command == "run":
        run_command(args.host, args.port)
    elif args.command == "test":
        test_command()
    elif args.command == "seed":
        seed_command(args.size)
    elif args.command == "reset":
        reset_command()

if __name__ == "__main__":
    main()
