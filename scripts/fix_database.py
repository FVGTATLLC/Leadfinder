#!/usr/bin/env python3
"""
Complete database reset and setup script for SalesPilot Nigeria.
Run this on Cloud Shell after connecting the SQL proxy.

Usage:
    ./cloud-sql-proxy salespilot-492012:africa-south1:salespilot-db --port=5432 &
    sleep 3
    python3 scripts/fix_database.py
"""

import bcrypt
import psycopg2
import sys

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "salespilot",
    "user": "postgres",
    "password": "Nimo2026!",
}

# Try postgres first (needs owner privileges to drop tables)
try:
    conn = psycopg2.connect(**DB_CONFIG)
except Exception:
    try:
        DB_CONFIG["port"] = 9470
        conn = psycopg2.connect(**DB_CONFIG)
    except Exception:
        DB_CONFIG["user"] = "salespilot_app"
        DB_CONFIG["port"] = 5432
        conn = psycopg2.connect(**DB_CONFIG)

conn.autocommit = True
cur = conn.cursor()
print(f"Connected as {DB_CONFIG['user']} on port {DB_CONFIG['port']}")

# ============================================================
# STEP 1: Drop ALL tables and recreate cleanly
# ============================================================
print("\n=== STEP 1: Dropping all existing tables ===")
cur.execute("""
    DROP TABLE IF EXISTS
        gmail_connections, crm_records, export_jobs, activity_logs,
        message_drafts, research_briefs, campaign_contacts, sequence_steps,
        campaigns, strategy_companies, strategies, contacts, companies,
        users, teams, alembic_version
    CASCADE
""")
print("All tables dropped.")

# ============================================================
# STEP 2: Create all tables with CORRECT schema
# ============================================================
print("\n=== STEP 2: Creating all tables ===")

cur.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

# The Base model adds: id (UUID PK), created_at, updated_at, is_deleted
BASE_COLS = """
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    is_deleted BOOLEAN DEFAULT false NOT NULL
"""

cur.execute(f"""
CREATE TABLE teams (
    {BASE_COLS},
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL
)
""")
print("  Created: teams")

cur.execute(f"""
CREATE TABLE users (
    {BASE_COLS},
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'sales_rep' NOT NULL,
    team_id UUID REFERENCES teams(id),
    is_active BOOLEAN DEFAULT true NOT NULL,
    last_login_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    must_change_password BOOLEAN DEFAULT false NOT NULL,
    sender_title VARCHAR(255),
    sender_phone VARCHAR(50)
)
""")
cur.execute("CREATE UNIQUE INDEX ix_users_email ON users(email)")
cur.execute("ALTER TABLE teams ADD CONSTRAINT fk_teams_created_by FOREIGN KEY (created_by) REFERENCES users(id)")
print("  Created: users")

cur.execute(f"""
CREATE TABLE companies (
    {BASE_COLS},
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    industry VARCHAR(255),
    sub_industry VARCHAR(255),
    geography VARCHAR(255),
    city VARCHAR(255),
    country VARCHAR(100),
    employee_count INTEGER,
    revenue_range VARCHAR(100),
    travel_intensity VARCHAR(20),
    company_size VARCHAR(20),
    icp_score FLOAT,
    score_breakdown JSON,
    source VARCHAR(100),
    linkedin_url VARCHAR(500),
    website VARCHAR(500),
    created_by UUID NOT NULL REFERENCES users(id)
)
""")
cur.execute("CREATE UNIQUE INDEX ix_companies_domain ON companies(domain)")
print("  Created: companies")

cur.execute(f"""
CREATE TABLE contacts (
    {BASE_COLS},
    company_id UUID REFERENCES companies(id),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    phone VARCHAR(50),
    job_title VARCHAR(255),
    persona_type VARCHAR(50) DEFAULT 'other',
    linkedin_url VARCHAR(500),
    confidence_score FLOAT,
    enrichment_status VARCHAR(20) DEFAULT 'pending',
    enrichment_source VARCHAR(100),
    enriched_at TIMESTAMPTZ,
    source VARCHAR(100),
    notes TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id)
)
""")
print("  Created: contacts")

cur.execute(f"""
CREATE TABLE strategies (
    {BASE_COLS},
    team_id UUID REFERENCES teams(id),
    created_by UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    filters JSON,
    status VARCHAR(20) DEFAULT 'draft',
    company_count INTEGER DEFAULT 0
)
""")
print("  Created: strategies")

cur.execute(f"""
CREATE TABLE strategy_companies (
    {BASE_COLS},
    strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(strategy_id, company_id)
)
""")
print("  Created: strategy_companies")

cur.execute(f"""
CREATE TABLE campaigns (
    {BASE_COLS},
    strategy_id UUID REFERENCES strategies(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    campaign_type VARCHAR(50) DEFAULT 'intro' NOT NULL,
    tone_preset VARCHAR(50) DEFAULT 'consultative' NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    contact_count INTEGER DEFAULT 0,
    step_count INTEGER DEFAULT 0
)
""")
print("  Created: campaigns")

cur.execute(f"""
CREATE TABLE sequence_steps (
    {BASE_COLS},
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    delay_days INTEGER DEFAULT 0,
    step_type VARCHAR(50) DEFAULT 'email',
    subject_template TEXT,
    body_template TEXT,
    is_ai_generated BOOLEAN DEFAULT false
)
""")
print("  Created: sequence_steps")

cur.execute(f"""
CREATE TABLE campaign_contacts (
    {BASE_COLS},
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    current_step INTEGER DEFAULT 0 NOT NULL,
    added_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(campaign_id, contact_id)
)
""")
print("  Created: campaign_contacts")

cur.execute(f"""
CREATE TABLE research_briefs (
    {BASE_COLS},
    company_id UUID REFERENCES companies(id),
    contact_id UUID REFERENCES contacts(id),
    brief_type VARCHAR(50) NOT NULL,
    content JSON,
    sources JSON,
    generated_by VARCHAR(100),
    llm_model_used VARCHAR(100),
    expires_at TIMESTAMPTZ
)
""")
print("  Created: research_briefs")

cur.execute(f"""
CREATE TABLE message_drafts (
    {BASE_COLS},
    sequence_step_id UUID REFERENCES sequence_steps(id),
    contact_id UUID NOT NULL REFERENCES contacts(id),
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    subject TEXT,
    body TEXT,
    tone VARCHAR(50),
    variant_label VARCHAR(100),
    context_data JSON,
    status VARCHAR(20) DEFAULT 'draft',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    error_message TEXT,
    scheduled_for TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id)
)
""")
print("  Created: message_drafts")

cur.execute(f"""
CREATE TABLE activity_logs (
    {BASE_COLS},
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    details JSON,
    ip_address VARCHAR(45)
)
""")
print("  Created: activity_logs")

cur.execute(f"""
CREATE TABLE export_jobs (
    {BASE_COLS},
    user_id UUID NOT NULL REFERENCES users(id),
    export_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    filters JSON,
    file_url TEXT,
    file_name VARCHAR(255),
    file_size BIGINT,
    record_count INTEGER,
    error_message TEXT,
    completed_at TIMESTAMPTZ
)
""")
print("  Created: export_jobs")

cur.execute(f"""
CREATE TABLE crm_records (
    {BASE_COLS},
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    crm_data JSON,
    exported_at TIMESTAMPTZ DEFAULT now()
)
""")
print("  Created: crm_records")

cur.execute(f"""
CREATE TABLE gmail_connections (
    {BASE_COLS},
    user_id UUID NOT NULL REFERENCES users(id),
    gmail_address VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    connected_at TIMESTAMPTZ DEFAULT now()
)
""")
print("  Created: gmail_connections")

cur.execute("""
CREATE TABLE alembic_version (
    version_num VARCHAR(32) PRIMARY KEY
)
""")
cur.execute("INSERT INTO alembic_version VALUES ('004')")
print("  Created: alembic_version")

# ============================================================
# STEP 3: Grant permissions
# ============================================================
print("\n=== STEP 3: Granting permissions ===")
cur.execute("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO salespilot_app")
cur.execute("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO salespilot_app")
cur.execute("GRANT USAGE ON SCHEMA public TO salespilot_app")
print("  Permissions granted to salespilot_app")

# ============================================================
# STEP 4: Create admin user with proper bcrypt hash
# ============================================================
print("\n=== STEP 4: Creating admin user ===")
password = b"Admin1234"
hashed = bcrypt.hashpw(password, bcrypt.gensalt()).decode()
print(f"  Generated hash: {hashed[:20]}... (length: {len(hashed)})")

# Verify the hash works
assert bcrypt.checkpw(password, hashed.encode()), "Hash verification failed!"
print("  Hash verification: PASSED")

cur.execute("""
    INSERT INTO users (email, password_hash, full_name, role, is_active, must_change_password)
    VALUES (%s, %s, %s, %s, %s, %s)
""", ("admin@clubconcierge.com", hashed, "Admin", "admin", True, False))
print("  Admin user created: admin@clubconcierge.com / Admin1234")

# Verify
cur.execute("SELECT email, role, is_active, is_deleted, length(password_hash) FROM users")
rows = cur.fetchall()
for row in rows:
    print(f"  DB Check: email={row[0]} role={row[1]} active={row[2]} deleted={row[3]} hash_len={row[4]}")

conn.close()
print("\n=== ALL DONE! Database is ready. ===")
print("Login: admin@clubconcierge.com / Admin1234")
