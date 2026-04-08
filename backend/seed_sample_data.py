"""Seed script: run with `python seed_sample_data.py`"""
import asyncio
import math
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from config import get_settings
from auth import hash_password

settings = get_settings()
client = AsyncIOMotorClient(settings.MONGODB_URI)
db = client[settings.DB_NAME]


def calc_emi(principal, annual_rate, tenure):
    if annual_rate == 0:
        return principal / tenure
    r = annual_rate / (12 * 100)
    n = tenure
    return principal * r * math.pow(1 + r, n) / (math.pow(1 + r, n) - 1)


async def seed():
    # Clear existing data
    for col_name in ["borrowers", "loans", "emi_schedule", "payments", "users", "settings"]:
        await db[col_name].delete_many({})

    # Settings
    await db["settings"].insert_many([
        {"key": "company_name", "value": "LoanDesk Financial Services"},
        {"key": "default_interest_rate", "value": "12"},
        {"key": "late_payment_penalty_percent", "value": "2"},
        {"key": "processing_fee_percent", "value": "1"},
    ])

    # Admin
    await db["users"].insert_one({
        "email": "admin@loan.local",
        "password": hash_password("admin123"),
        "name": "Admin",
        "role": "admin",
    })

    # Borrowers
    borrowers_data = [
        {"name": "Rajesh Kumar", "phone": "9876543210", "email": "rajesh@example.com", "address": "12 MG Road, Mumbai", "id_type": "aadhaar", "id_number": "1234-5678-9012", "occupation": "Software Engineer", "monthly_income": 95000, "credit_score": 780},
        {"name": "Priya Sharma", "phone": "9876543211", "email": "priya@example.com", "address": "45 Park Street, Delhi", "id_type": "pan", "id_number": "ABCPS1234K", "occupation": "Doctor", "monthly_income": 100000, "credit_score": 800},
        {"name": "Amit Patel", "phone": "9876543212", "email": "amit@example.com", "address": "78 Ring Road, Ahmedabad", "id_type": "aadhaar", "id_number": "9876-5432-1098", "occupation": "Business Owner", "monthly_income": 75000, "credit_score": 720},
        {"name": "Sunita Devi", "phone": "9876543213", "email": "sunita@example.com", "address": "23 Lake Road, Kolkata", "id_type": "aadhaar", "id_number": "5678-1234-9876", "occupation": "Teacher", "monthly_income": 45000, "credit_score": 690},
        {"name": "Vikram Singh", "phone": "9876543214", "email": "vikram@example.com", "address": "56 Civil Lines, Jaipur", "id_type": "pan", "id_number": "DEFVS5678L", "occupation": "Architect", "monthly_income": 80000, "credit_score": 750},
        {"name": "Meena Reddy", "phone": "9876543215", "email": "meena@example.com", "address": "90 Jubilee Hills, Hyderabad", "id_type": "aadhaar", "id_number": "3456-7890-1234", "occupation": "CA", "monthly_income": 85000, "credit_score": 770},
        {"name": "Arjun Nair", "phone": "9876543216", "email": "arjun@example.com", "address": "34 Marine Drive, Kochi", "id_type": "pan", "id_number": "GHIAN9012M", "occupation": "Manager", "monthly_income": 60000, "credit_score": 710},
        {"name": "Kavita Joshi", "phone": "9876543217", "email": "kavita@example.com", "address": "67 FC Road, Pune", "id_type": "aadhaar", "id_number": "7890-1234-5678", "occupation": "Nurse", "monthly_income": 35000, "credit_score": 680},
        {"name": "Deepak Gupta", "phone": "9876543218", "email": "deepak@example.com", "address": "11 Hazratganj, Lucknow", "id_type": "pan", "id_number": "JKLDG3456N", "occupation": "Shopkeeper", "monthly_income": 50000, "credit_score": 700},
        {"name": "Ananya Menon", "phone": "9876543219", "email": "ananya@example.com", "address": "89 Brigade Road, Bangalore", "id_type": "aadhaar", "id_number": "2345-6789-0123", "occupation": "Designer", "monthly_income": 70000, "credit_score": 740},
    ]

    now = datetime.now(timezone.utc)
    borrower_ids = []
    for b in borrowers_data:
        b["is_active"] = True
        b["created_at"] = now - timedelta(days=180)
        b["updated_at"] = now - timedelta(days=180)
        result = await db["borrowers"].insert_one(b)
        borrower_ids.append(str(result.inserted_id))

    # Loans
    loans_data = [
        {"borrower_idx": 0, "principal": 500000, "rate": 12, "tenure": 36, "type": "personal", "purpose": "Home renovation", "status": "active", "days_ago": 150},
        {"borrower_idx": 1, "principal": 5000000, "rate": 8.5, "tenure": 240, "type": "home", "purpose": "Flat purchase", "status": "active", "days_ago": 120},
        {"borrower_idx": 2, "principal": 200000, "rate": 14, "tenure": 24, "type": "personal", "purpose": "Wedding expenses", "status": "active", "days_ago": 90},
        {"borrower_idx": 3, "principal": 3000000, "rate": 9, "tenure": 180, "type": "home", "purpose": "House construction", "status": "active", "days_ago": 60},
        {"borrower_idx": 4, "principal": 800000, "rate": 11, "tenure": 48, "type": "vehicle", "purpose": "Car purchase", "status": "active", "days_ago": 100},
        {"borrower_idx": 5, "principal": 1000000, "rate": 13, "tenure": 36, "type": "business", "purpose": "Business expansion", "status": "pending", "days_ago": 10},
        {"borrower_idx": 6, "principal": 300000, "rate": 10, "tenure": 48, "type": "education", "purpose": "MBA fees", "status": "active", "days_ago": 80},
        {"borrower_idx": 7, "principal": 50000, "rate": 15, "tenure": 12, "type": "personal", "purpose": "Medical emergency", "status": "active", "days_ago": 70},
    ]

    loan_ids = []
    for idx, ld in enumerate(loans_data):
        emi = round(calc_emi(ld["principal"], ld["rate"], ld["tenure"]), 2)
        total_payable = round(emi * ld["tenure"], 2)
        total_interest = round(total_payable - ld["principal"], 2)
        processing_fee = round(ld["principal"] * 0.01, 2)

        created = now - timedelta(days=ld["days_ago"])
        loan_number = f"LN-{created.strftime('%Y%m%d')}-{str(idx + 1).zfill(4)}"

        loan = {
            "loan_number": loan_number,
            "borrower_id": borrower_ids[ld["borrower_idx"]],
            "borrower_name": borrowers_data[ld["borrower_idx"]]["name"],
            "principal_amount": ld["principal"],
            "interest_rate_annual": ld["rate"],
            "tenure_months": ld["tenure"],
            "loan_type": ld["type"],
            "purpose": ld["purpose"],
            "collateral_description": "",
            "emi_amount": emi,
            "total_interest": total_interest,
            "total_payable": total_payable,
            "processing_fee": processing_fee,
            "outstanding_amount": total_payable,
            "paid_amount": 0,
            "status": ld["status"],
            "disbursement_date": created if ld["status"] == "active" else None,
            "rejection_reason": None,
            "created_at": created,
            "updated_at": created,
        }

        result = await db["loans"].insert_one(loan)
        loan_ids.append(str(result.inserted_id))

        # Generate EMI schedule
        r = ld["rate"] / (12 * 100) if ld["rate"] > 0 else 0
        balance = ld["principal"]
        emis = []
        for i in range(1, ld["tenure"] + 1):
            interest_comp = round(balance * r, 2) if r > 0 else 0
            principal_comp = round(emi - interest_comp, 2)
            if i == ld["tenure"]:
                principal_comp = round(balance, 2)
            due_date = created + timedelta(days=30 * i)
            emis.append({
                "loan_id": str(result.inserted_id),
                "installment_number": i,
                "due_date": due_date,
                "principal_component": principal_comp,
                "interest_component": interest_comp,
                "emi_amount": round(principal_comp + interest_comp, 2),
                "balance_after": round(max(balance - principal_comp, 0), 2),
                "status": "unpaid",
                "payment_date": None,
                "penalty_amount": 0,
                "created_at": created,
            })
            balance -= principal_comp

        if emis:
            await db["emi_schedule"].insert_many(emis)

    # Payments - pay some EMIs for active loans
    payment_count = 0
    payment_scenarios = [
        # (loan_index, num_emis_to_pay, include_late)
        (0, 4, True),   # Rajesh: 4 EMIs, some late
        (1, 3, False),  # Priya: 3 EMIs on time
        (2, 2, True),   # Amit: 2 EMIs, one late
        (3, 1, False),  # Sunita: 1 EMI on time
        (4, 3, True),   # Vikram: 3 EMIs, one late
        (6, 2, False),  # Arjun: 2 EMIs on time
        (7, 5, True),   # Kavita: 5 EMIs, some late
    ]

    for loan_idx, num_emis, include_late in payment_scenarios:
        loan_id = loan_ids[loan_idx]
        loan_data = loans_data[loan_idx]
        total_paid_for_loan = 0

        emis_cursor = db["emi_schedule"].find({"loan_id": loan_id}).sort("installment_number", 1).limit(num_emis)
        emi_list = await emis_cursor.to_list(num_emis)

        for j, emi_doc in enumerate(emi_list):
            is_late = include_late and (j % 3 == 2)
            penalty = round(emi_doc["emi_amount"] * 0.02, 2) if is_late else 0
            payment_date = emi_doc["due_date"] + timedelta(days=15 if is_late else -2)

            total_amount = emi_doc["emi_amount"] + penalty
            total_paid_for_loan += total_amount

            await db["emi_schedule"].update_one(
                {"_id": emi_doc["_id"]},
                {"$set": {"status": "paid", "payment_date": payment_date, "penalty_amount": penalty}},
            )

            payment_count += 1
            receipt = f"RCP-{payment_date.strftime('%Y%m%d')}-{str(payment_count).zfill(4)}"
            await db["payments"].insert_one({
                "loan_id": loan_id,
                "loan_number": f"LN-{(now - timedelta(days=loan_data['days_ago'])).strftime('%Y%m%d')}-{str(loan_idx + 1).zfill(4)}",
                "borrower_name": borrowers_data[loan_data["borrower_idx"]]["name"],
                "amount": total_amount,
                "penalty_amount": penalty,
                "payment_method": ["cash", "upi", "bank_transfer", "cheque"][j % 4],
                "transaction_ref": f"TXN{payment_count:06d}",
                "receipt_number": receipt,
                "emis_paid": [{"installment_number": emi_doc["installment_number"], "emi_amount": emi_doc["emi_amount"], "penalty": penalty, "total": total_amount}],
                "payment_date": payment_date,
                "created_at": payment_date,
            })

        # Update loan outstanding
        emi_val = round(calc_emi(loan_data["principal"], loan_data["rate"], loan_data["tenure"]), 2)
        total_payable = round(emi_val * loan_data["tenure"], 2)
        await db["loans"].update_one(
            {"_id": (await db["loans"].find_one({"loan_number": {"$regex": str(loan_idx + 1).zfill(4)}}))["_id"]},
            {"$set": {"outstanding_amount": round(total_payable - total_paid_for_loan, 2), "paid_amount": round(total_paid_for_loan, 2)}},
        )

    # Indexes
    await db["borrowers"].create_index("phone", unique=True)
    await db["loans"].create_index("loan_number", unique=True)
    await db["emi_schedule"].create_index([("loan_id", 1), ("installment_number", 1)], unique=True)
    await db["payments"].create_index([("loan_id", 1), ("payment_date", 1)])

    print(f"Seeded: 10 borrowers, 8 loans, {payment_count} payments")
    print("Admin: admin@loan.local / admin123")


if __name__ == "__main__":
    asyncio.run(seed())
