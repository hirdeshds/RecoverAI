import os
import json
import random
import urllib.request
from datetime import datetime
from sqlalchemy.orm import Session
from server.models import Case, CaseEvent, BlacklistItem, DecisionRule, PlaybookConfig

# ── Integrations Settings ──
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
LLM_MODEL = os.getenv("LLM_MODEL", "claude-3-5-sonnet")

class RecoveryAgent:
    
    @staticmethod
    def add_event(db: Session, case_id: str, level: str, title: str, description: str, channel: str = None, bubble: str = None, is_voice: bool = False):
        event = CaseEvent(
            case_id=case_id,
            timestamp=datetime.now().strftime("%I:%M:%S %p"),
            level=level,
            title=title,
            description=description,
            channel=channel,
            bubble=bubble,
            is_voice=is_voice
        )
        db.add(event)
        db.commit()

    @classmethod
    def step_case(cls, case: Case, db: Session, timezone_offset: int = 0) -> None:
        """
        Executes a single tick transition step of the case recovery state machine.
        """
        # Step 1: Diagnose raw failure cause
        if case.status == "ingested":
            case.status = "recovering"
            db.commit()
            
            cls.add_event(db, case.id, "INGEST", "Case Ingested Pool", f"Raw billing failure received. Scenario category: {case.type}. Amount: ${case.amount}")
            
            # Formulate diagnostics description
            diagnostics = cls.run_ai_diagnostics(case)
            cls.add_event(db, case.id, "DIAGNOSE", "AI Failure Classification", diagnostics)
            return

        # Step 2: Enforce Compliance Shields (Guardrails)
        if not cls.evaluate_compliance_shields(case, db, timezone_offset):
            return

        # Step 3: Evaluate Custom overrides Matrix Rules
        override_rule = cls.evaluate_decision_matrix(case, db)
        if override_rule:
            cls.apply_override_action(case, db, override_rule)
            return

        # Step 4: Load Playbook configurations steps
        pb_config = db.query(PlaybookConfig).filter(PlaybookConfig.id == case.type).first()
        steps = []
        if pb_config:
            steps = [s.strip() for s in pb_config.steps.split(",") if s.strip()]
        else:
            # Fallback playbooks matching baseline DEFAULT_PLAYBOOKS
            fallbacks = {
                "saas_fail": ["retry_api", "email_reminder", "sms_alert", "voice_recovery", "escalate_human"],
                "checkout_drop": ["email_reminder", "sms_alert", "escalate_human"],
                "b2b_collect": ["email_reminder", "sms_alert", "voice_recovery", "escalate_human"],
                "hinglish_voice": ["retry_api", "email_reminder", "hinglish_voice", "escalate_human"]
            }
            steps = fallbacks.get(case.type, ["email_reminder", "escalate_human"])

        if case.current_step_index >= len(steps):
            cls.terminate_case(case, db, "failed", "Autopilot playbook steps exhausted without recovery.")
            return

        active_step = steps[case.current_step_index]
        cls.execute_playbook_step(case, db, active_step)

    @staticmethod
    def run_ai_diagnostics(case: Case) -> str:
        mappings = {
            "expired_card": "Stripe API response: expired_card token. Decline is 100% deterministic. Recommend bypassing card retries.",
            "insufficient_funds": "Gateway billing report: insufficient_funds. Probable temporary liquidity constraints. Retry sequences recommended.",
            "card_declined": "Processor code: card_declined. Bank fraud protection rules triggered or card restricted. Direct dunning alert required.",
            "abandoned_cart": "Analytics Sync: User drop-off during checkout address entry phase. Chaser coupon chaser recommended.",
            "invoice_30d_overdue": "B2B Aging: Invoice overdue by 30 days. Standard corporate accounts payable backlog suspected.",
            "invoice_60d_overdue": "B2B Aging: Invoice overdue 60 days. Risk multiplier elevated. Direct dialogue chaser recommended.",
            "billing_dispute": "Ticket Sync: Client initiated billing dispute. Lock automated alerts to prevent friction escalation."
        }
        return mappings.get(case.failure_reason, "Diagnostics report: Generic payment declined exception details.")

    @classmethod
    def evaluate_compliance_shields(cls, case: Case, db: Session, timezone_offset: int) -> bool:
        # Blacklist check
        blacklist_match = db.query(BlacklistItem).filter(
            (BlacklistItem.value == case.email) | (BlacklistItem.value == case.email.split("@")[-1])
        ).first()
        
        if blacklist_match:
            cls.terminate_case(case, db, "suppressed", f"Blacklist suppression match triggered: '{blacklist_match.value}'")
            cls.add_event(db, case.id, "GUARDRAIL", "Compliance Excluded", f"Blacklisted key match block. Autoflow cancelled.")
            return False

        # Support dispute check
        if case.has_support_ticket:
            cls.terminate_case(case, db, "suppressed", "Active billing support ticket dispute hold override.")
            cls.add_event(db, case.id, "GUARDRAIL", "Dispute Hold suppress", "Bypassed recovery alerts during active client support ticket.")
            return False

        # DND Quiet Hours Timezone check
        local_hour = cls.get_timezone_local_hour(case.timezone, timezone_offset)
        if local_hour >= 21 or local_hour < 8:
            cls.add_event(db, case.id, "GUARDRAIL", "DND Compliance Hold", f"Outbound blocked. Customer local hour is {local_hour}:00. Re-attempt scheduled.")
            return False

        return True

    @staticmethod
    def get_timezone_local_hour(tz: str, timezone_offset: int) -> int:
        base_hour = datetime.now().hour
        shift = 0
        if "New_York" in tz or "US/Eastern" in tz: shift = -10.5
        elif "US/Pacific" in tz: shift = -13.5
        elif "London" in tz: shift = -5.5
        elif "Tokyo" in tz: shift = 3.5
        
        local = (base_hour + shift + timezone_offset) % 24
        if local < 0: local += 24
        return int(local)

    @staticmethod
    def evaluate_decision_matrix(case: Case, db: Session) -> Optional[DecisionRule]:
        active_rules = db.query(DecisionRule).filter(DecisionRule.active == True).all()
        for rule in active_rules:
            # Prepare expression context
            expr = rule.criterion\
                .replace("amount", str(case.amount))\
                .replace("reason", f"'{case.failure_reason}'")\
                .replace("type", f"'{case.type}'")\
                .replace("intent", str(case.intent_score))
            try:
                if eval(expr):
                    return rule
            except Exception:
                pass
        return None

    @classmethod
    def apply_override_action(cls, case: Case, db: Session, rule: DecisionRule):
        cls.add_event(db, case.id, "GUARDRAIL", f"Override match: {rule.name}", f"Short-circuit route path action: {rule.action}")
        
        if rule.action == "force_human":
            cls.terminate_case(case, db, "failed", "High-value enterprise case escalated straight to manual account ops.")
        elif rule.action == "bypass_retry":
            case.current_step_index = 1 # Skip retry_api
            case.status = "recovering"
            db.commit()
            cls.step_case(case, db) # re-trigger
        elif rule.action == "apply_coupon":
            case.has_coupon = True
            # Reconstruct playbook steps omitting card retries
            case.current_step_index = 0
            case.status = "recovering"
            db.commit()
            cls.step_case(case, db)
        elif rule.action == "suppress":
            cls.terminate_case(case, db, "suppressed", "Override rules matrix suppressed chaser alerts.")

    @classmethod
    def execute_playbook_step(cls, case: Case, db: Session, step: str):
        if step == "retry_api":
            cls.execute_retry_api(case, db)
        elif step == "email_reminder":
            cls.execute_email_chaser(case, db)
        elif step == "sms_alert":
            cls.execute_sms_chaser(case, db)
        elif step == "voice_recovery":
            cls.execute_voice_chaser(case, db, bilingual=False)
        elif step == "hinglish_voice":
            cls.execute_voice_chaser(case, db, bilingual=True)
        elif step == "escalate_human":
            cls.terminate_case(case, db, "failed", "Dunning alert attempt caps reached. Escalate to Collections Rep.")
            cls.add_event(db, case.id, "FAIL", "Human Escalation Handoff", "Case assigned to manual operations ledger.")

    @classmethod
    def execute_retry_api(cls, case: Case, db: Session):
        case.total_retries += 1
        cls.add_event(db, case.id, "ACTION", "API Payment Retry Request", f"Submitting gateway authorization request. Attempt #{case.total_retries}", "card_retry")
        
        # Probabilistic success calculation (expired card = 0, insufficient funds = 20%)
        success_chance = 0.05
        if case.failure_reason == "insufficient_funds":
            success_chance = 0.20
            
        if random.random() < success_chance:
            cls.terminate_case(case, db, "recovered", "Gateway retry charge approved.")
        else:
            cls.add_event(db, case.id, "FAIL", "Auth Declined", "Stripe payment processor declined: insufficient funds.")
            case.current_step_index += 1
            db.commit()

    @classmethod
    def execute_email_chaser(cls, case: Case, db: Session):
        case.contact_attempts += 1
        
        # Load custom messages or compile LLM texts
        text = "Hi {Name}, your subscription payment of {Amount} declined. Update details here to prevent service interruption: {Link}"
        text = cls.personalize_template(text, case)
        
        cls.add_event(db, case.id, "ACTION", "Email Dunning Dispatched", f"Dunning notice sent to customer address: {case.email}", "email", text)

        # Mock conversions
        if random.random() < (case.intent_score / 130):
            cls.terminate_case(case, db, "recovered", "Customer clicked billing link, card payment updated.")
        else:
            case.current_step_index += 1
            db.commit()

    @classmethod
    def execute_sms_chaser(cls, case: Case, db: Session):
        case.contact_attempts += 1
        
        text = "RecoverAI: Hello {Name}. Payment of {Amount} failed. Quick pay here to unlock account: {Link}"
        text = cls.personalize_template(text, case)

        cls.add_event(db, case.id, "ACTION", "Chaser SMS Dispatched", f"SMS notification alert delivered to number: {case.phone}", "sms", text)

        if random.random() < (case.intent_score / 115):
            cls.terminate_case(case, db, "recovered", "Customer authenticated transaction via SMS checkout portal link.")
        else:
            case.current_step_index += 1
            db.commit()

    @classmethod
    def execute_voice_chaser(cls, case: Case, db: Session, bilingual: bool = False):
        case.contact_attempts += 1
        
        if bilingual:
            dialogue = f"RecoverAI Agent: Namaste {case.customer_name} ji. Hum RecoverAI se baat kar rahe hain. Aapka payment of ${case.amount} failed hua hai.\n{case.customer_name}: Accha card decline hua tha. Main bhejey hue link se update karti hoon.\nRecoverAI Agent: Shukriya ji!"
            title = "Hinglish AI Voice Connected"
            log_desc = f"Bilingual dialect agent call simulation connected with customer: {case.phone}"
        else:
            dialogue = f"RecoverAI Bot: Hello {case.customer_name}. We detected a transaction failure of ${case.amount}.\n{case.customer_name}: Yes, let me update details.\nRecoverAI Bot: Secure update link delivered. Thank you."
            title = "AI Voice Bot Connected"
            log_desc = f"Outbound speech agent call connected with customer: {case.phone}"

        cls.add_event(db, case.id, "ACTION", title, log_desc, "voice", dialogue, is_voice=True)

        success_rate = (case.intent_score + 10) / 95 if bilingual else case.intent_score / 85
        if random.random() < success_rate:
            cls.terminate_case(case, db, "recovered", "Bilingual voice dialogue payment authorized.")
        else:
            case.current_step_index += 1
            db.commit()

    @classmethod
    def terminate_case(cls, case: Case, db: Session, status: str, log_desc: str):
        case.status = status
        db.commit()
        
        level = "SUCCESS" if status == "recovered" else ("FAIL" if status == "failed" else "GUARDRAIL")
        title = "Revenue Recovered!" if status == "recovered" else ("Dunning Abandoned" if status == "failed" else "Outreach Suppressed")
        
        cls.add_event(db, case.id, level, title, log_desc)

    @staticmethod
    def personalize_template(text: str, case: Case) -> str:
        res = text.replace("{Name}", case.customer_name)\
                  .replace("{Amount}", f"${case.amount}")\
                  .replace("{Link}", case.recoveryLink)
        if case.has_coupon:
            res += " Code RECOVER10 (10% discount) attached."
        
        # If Anthropic API key is active, personalize details
        if ANTHROPIC_API_KEY:
            try:
                res = call_llm_personalize(res, case.customer_name, case.amount, case.failure_reason)
            except Exception:
                pass
        return res

def call_llm_personalize(prompt: str, name: str, amount: float, reason: str) -> str:
    # Lightweight urllib POST call to Anthropic API to avoid heavy SDK installations
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    data = {
        "model": LLM_MODEL,
        "max_tokens": 120,
        "messages": [
            {"role": "user", "content": f"Personalize this chaser notification message: '{prompt}' for customer name '{name}' who failed payment of ${amount} due to '{reason}'. Make it polite and professional. Return only the final single-line chaser message."}
        ]
    }
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=5) as response:
        res_data = json.loads(response.read().decode("utf-8"))
        return res_data["content"][0]["text"].strip()
