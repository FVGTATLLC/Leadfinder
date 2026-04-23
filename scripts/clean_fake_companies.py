#!/usr/bin/env python3
"""
Soft-delete companies whose domains do not actually resolve.
Run on Cloud Shell with the SQL proxy active on port 5432.
"""
import socket
import sys
import psycopg2

DB = {
    "host": "localhost",
    "port": 5432,
    "database": "salespilot",
    "user": "postgres",
    "password": "Nimo2026!",
}

try:
    conn = psycopg2.connect(**DB)
except Exception:
    DB["port"] = 9470
    conn = psycopg2.connect(**DB)
conn.autocommit = True
cur = conn.cursor()

print("Fetching companies...")
cur.execute("""
    SELECT id, name, domain
    FROM companies
    WHERE is_deleted = false
      AND domain IS NOT NULL
      AND domain != ''
""")
rows = cur.fetchall()
print(f"Checking {len(rows)} domains...\n")

bad_ids = []
socket.setdefaulttimeout(3)

for cid, name, domain in rows:
    clean = domain.lower().replace("https://", "").replace("http://", "").rstrip("/")
    try:
        socket.gethostbyname(clean)
        # ok
    except Exception:
        print(f"  ❌ {name:<50} | {domain}")
        bad_ids.append(cid)

print(f"\nFound {len(bad_ids)} fake domains.")

if bad_ids:
    confirm = input("Soft-delete these companies? (yes/no): ").strip().lower()
    if confirm == "yes":
        # Delete dependent records first
        ids_str = ",".join(f"'{i}'" for i in bad_ids)
        cur.execute(f"DELETE FROM message_drafts WHERE contact_id IN (SELECT id FROM contacts WHERE company_id IN ({ids_str}))")
        cur.execute(f"DELETE FROM campaign_contacts WHERE contact_id IN (SELECT id FROM contacts WHERE company_id IN ({ids_str}))")
        cur.execute(f"DELETE FROM research_briefs WHERE company_id IN ({ids_str})")
        cur.execute(f"UPDATE contacts SET is_deleted = true WHERE company_id IN ({ids_str})")
        cur.execute(f"DELETE FROM strategy_companies WHERE company_id IN ({ids_str})")
        cur.execute(f"UPDATE companies SET is_deleted = true WHERE id IN ({ids_str})")
        print(f"✅ Soft-deleted {len(bad_ids)} fake companies and their related data.")
    else:
        print("Cancelled.")
else:
    print("No fake domains found - all companies have working URLs.")

conn.close()
