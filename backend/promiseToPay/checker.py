from datetime import datetime

def check_promises(db_cursor):
    """
    Cron / polling checker that queries pending promise_to_pay records 
    and checks if they are honored or missed.
    """
    now = datetime.utcnow()
    db_cursor.execute("SELECT id, promised_date, intervention_id FROM promise_to_pay WHERE status = 'pending'")
    rows = db_cursor.fetchall()
    
    updates = []
    for row in rows:
        p_id, promised_date_str, _ = row
        promised_date = datetime.fromisoformat(promised_date_str)
        if now > promised_date:
            updates.append((p_id, "missed"))
            
    for p_id, new_status in updates:
        db_cursor.execute("UPDATE promise_to_pay SET status = ? WHERE id = ?", (new_status, p_id))
        
    return {"checked": len(rows), "updated": len(updates)}
