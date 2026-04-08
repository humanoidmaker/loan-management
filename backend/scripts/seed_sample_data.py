import asyncio, sys, random, math
from datetime import datetime, timezone, timedelta
sys.path.insert(0, ".")
from app.core.database import init_db, get_db

BORROWERS = [
    ("Aarav Sharma", "9876540001", "Salaried", 50000, 720), ("Diya Patel", "9876540002", "Self-employed", 75000, 680),
    ("Vihaan Reddy", "9876540003", "Salaried", 35000, 750), ("Ananya Nair", "9876540004", "Business", 100000, 700),
    ("Arjun Desai", "9876540005", "Salaried", 60000, 690), ("Ishita Gupta", "9876540006", "Salaried", 45000, 730),
    ("Kabir Singh", "9876540007", "Business", 80000, 660), ("Myra Joshi", "9876540008", "Self-employed", 55000, 710),
    ("Reyansh Verma", "9876540009", "Salaried", 40000, 740), ("Saanvi Pillai", "9876540010", "Salaried", 65000, 700),
]

LOANS = [
    ("personal", 200000, 14, 24, "Home renovation"), ("home", 3000000, 8.5, 240, "Home purchase"),
    ("personal", 100000, 15, 12, "Medical emergency"), ("vehicle", 500000, 10, 60, "Car purchase"),
    ("business", 1000000, 12, 36, "Business expansion"), ("education", 400000, 9, 48, "MBA fees"),
    ("personal", 50000, 16, 6, "Travel"), ("business", 2000000, 11, 60, "Equipment purchase"),
]

def calc_emi(principal, annual_rate, tenure):
    if annual_rate == 0: return round(principal / tenure, 2)
    r = annual_rate / 12 / 100
    n = tenure
    return round(principal * r * math.pow(1 + r, n) / (math.pow(1 + r, n) - 1), 2)

async def seed():
    await init_db()
    db = await get_db()
    if await db.borrowers.count_documents({}) > 0:
        print("Data exists"); return

    now = datetime.now(timezone.utc)
    borrower_ids = []
    for name, phone, occ, income, score in BORROWERS:
        r = await db.borrowers.insert_one({
            "name": name, "phone": phone, "email": f"{name.split()[0].lower()}@example.com",
            "address": f"{random.randint(1, 500)} Main Road, City",
            "id_type": random.choice(["aadhaar", "pan"]), "id_number": f"XXXX{random.randint(1000,9999)}",
            "occupation": occ, "monthly_income": income, "credit_score": score,
            "is_active": True, "created_at": now,
        })
        borrower_ids.append(str(r.inserted_id))

    statuses = ["active", "active", "active", "active", "active", "pending", "closed", "active"]

    for i, (loan_type, principal, rate, tenure, purpose) in enumerate(LOANS):
        borrower_id = borrower_ids[i % len(borrower_ids)]
        emi = calc_emi(principal, rate, tenure)
        total_payable = round(emi * tenure, 2)
        total_interest = round(total_payable - principal, 2)
        status = statuses[i]
        loan_date = now - timedelta(days=random.randint(30, 180))

        # EMI schedule
        schedule = []
        balance = principal
        monthly_rate = rate / 12 / 100
        for j in range(tenure):
            interest = round(balance * monthly_rate, 2)
            princ = round(emi - interest, 2)
            balance = max(0, round(balance - princ, 2))
            due = (loan_date + timedelta(days=30 * (j + 1))).strftime("%Y-%m-%d")
            today = now.strftime("%Y-%m-%d")

            if status == "active" and j < random.randint(2, 6):
                emi_status = "paid"
                paid_date = (loan_date + timedelta(days=30 * (j + 1) + random.randint(-2, 5))).strftime("%Y-%m-%d")
            elif status == "closed":
                emi_status = "paid"
                paid_date = due
            else:
                emi_status = "unpaid"
                paid_date = None

            penalty = 0
            if emi_status == "paid" and paid_date and paid_date > due:
                days_late = (datetime.strptime(paid_date, "%Y-%m-%d") - datetime.strptime(due, "%Y-%m-%d")).days
                penalty = round(emi * 0.02 * days_late / 30, 2)

            schedule.append({
                "installment_number": j + 1, "due_date": due, "emi_amount": emi,
                "principal_component": princ, "interest_component": interest,
                "balance_after": balance, "status": emi_status, "paid_date": paid_date, "penalty": penalty,
            })

        paid_emis = [e for e in schedule if e["status"] == "paid"]
        outstanding = principal - sum(e["principal_component"] for e in paid_emis) if status != "closed" else 0

        r = await db.loans.insert_one({
            "loan_number": f"LN-{loan_date.strftime('%Y%m%d')}-{1000+i}",
            "borrower_id": borrower_id, "principal_amount": principal,
            "interest_rate_annual": rate, "tenure_months": tenure,
            "emi_amount": emi, "total_interest": total_interest, "total_payable": total_payable,
            "processing_fee": round(principal * 0.01, 2),
            "loan_type": loan_type, "purpose": purpose,
            "outstanding_amount": max(0, round(outstanding, 2)),
            "status": status, "emi_schedule": schedule,
            "disbursement_date": loan_date.isoformat() if status != "pending" else None,
            "created_at": loan_date,
        })

        # Record payments for paid EMIs
        for e in paid_emis:
            await db.payments.insert_one({
                "loan_id": str(r.inserted_id), "loan_number": f"LN-{loan_date.strftime('%Y%m%d')}-{1000+i}",
                "amount": e["emi_amount"] + e["penalty"], "penalty": e["penalty"],
                "payment_method": random.choice(["bank_transfer", "upi", "cheque"]),
                "receipt_number": f"RCP-{random.randint(100000, 999999)}",
                "emis_covered": 1, "created_at": datetime.strptime(e["paid_date"], "%Y-%m-%d"),
            })

    print(f"Seeded: {len(BORROWERS)} borrowers, {len(LOANS)} loans with EMI schedules + payments")

asyncio.run(seed())
