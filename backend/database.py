from motor.motor_asyncio import AsyncIOMotorClient
from config import get_settings

settings = get_settings()

client = AsyncIOMotorClient(settings.MONGODB_URI)
db = client[settings.DB_NAME]

# Collections
borrowers_col = db["borrowers"]
loans_col = db["loans"]
emi_schedule_col = db["emi_schedule"]
payments_col = db["payments"]
users_col = db["users"]
settings_col = db["settings"]


async def init_db():
    """Create indexes and seed default settings."""
    await borrowers_col.create_index("phone", unique=True)
    await loans_col.create_index("loan_number", unique=True)
    await emi_schedule_col.create_index(
        [("loan_id", 1), ("installment_number", 1)], unique=True
    )
    await payments_col.create_index([("loan_id", 1), ("payment_date", 1)])

    # Seed default settings
    existing = await settings_col.find_one({"key": "company_name"})
    if not existing:
        defaults = [
            {"key": "company_name", "value": "LoanDesk Financial Services"},
            {"key": "default_interest_rate", "value": "12"},
            {"key": "late_payment_penalty_percent", "value": "2"},
            {"key": "processing_fee_percent", "value": "1"},
        ]
        await settings_col.insert_many(defaults)

    # Seed admin user
    from auth import hash_password
    existing_admin = await users_col.find_one({"email": settings.ADMIN_EMAIL})
    if not existing_admin:
        await users_col.insert_one({
            "email": settings.ADMIN_EMAIL,
            "password": hash_password(settings.ADMIN_PASSWORD),
            "name": "Admin",
            "role": "admin",
        })
