# LoanDesk — Loan Management

Loan processing with EMI calculator, repayment schedules, payment tracking, and overdue alerts.

## Tech Stack

Python FastAPI + Motor (MongoDB) + React + TypeScript

## Features

- **Borrower management with credit profiles**
- **Loan application with auto EMI calculation**
- **Standard EMI formula implementation**
- **Full amortization schedule generation**
- **Payment recording with late penalty calculation**
- **Loan approval/rejection workflow**
- **Overdue EMI tracking**
- **Public EMI calculator (no login needed)**
- **Dashboard with portfolio stats**

## Setup

### Using Docker (Recommended)

```bash
docker-compose up
```

### Manual Setup

**Backend:**
```bash
cd backend
pip install -r requirements.txt
# Set environment variables (copy .env.example to .env)
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Seed Data:**
```bash
cd backend
python -m scripts.seed_admin
python -m scripts.seed_sample_data
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| MONGODB_URI / DATABASE_URL | Database connection string | localhost |
| JWT_SECRET | Secret key for JWT tokens | (required) |
| CORS_ORIGINS | Allowed frontend origins | http://localhost:3000 |
| SMTP_HOST | SMTP server for emails | (optional) |
| SMTP_PORT | SMTP port | 587 |
| SMTP_USER | SMTP username | (optional) |
| SMTP_PASS | SMTP password | (optional) |

## Default Login

- **Admin:** admin@loan.local / admin123

## License

MIT License — Copyright (c) 2026 Humanoid Maker (www.humanoidmaker.com)
