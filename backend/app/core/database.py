from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

client = None
db = None

async def get_db():
    return db

async def connect_db():
    """Alias for init_db for compatibility."""
    await init_db()

async def init_db():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db_name = settings.MONGODB_URI.rsplit("/", 1)[-1].split("?")[0] or "app_db"
    db = client[db_name]
    await db.users.create_index("email", unique=True)
    # Seed default settings
    if not await db.settings.find_one({"key": "app_name"}):
        await db.settings.insert_many([
            {"key": "app_name", "value": "App"},
            {"key": "smtp_host", "value": ""},
            {"key": "smtp_port", "value": "587"},
            {"key": "smtp_user", "value": ""},
            {"key": "smtp_pass", "value": ""},
            {"key": "smtp_from", "value": ""},
            {"key": "email_verification_enabled", "value": "true"},
            {"key": "email_welcome_enabled", "value": "true"},
            {"key": "email_password_reset_enabled", "value": "true"},
            {"key": "email_password_changed_enabled", "value": "true"},
            {"key": "require_email_verification", "value": "false"},
        ])
