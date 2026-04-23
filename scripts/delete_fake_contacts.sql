-- Delete all fake AI-generated contacts (and their related data)
-- Run this in psql after connecting to the salespilot database

-- Show what will be deleted
SELECT COUNT(*) AS "Contacts to delete" FROM contacts
WHERE is_deleted = false
  AND (source = 'ai_discovery' OR source = 'ai' OR enrichment_status = 'pending');

-- Delete message drafts linked to fake contacts (to satisfy FK)
DELETE FROM message_drafts
WHERE contact_id IN (
  SELECT id FROM contacts
  WHERE is_deleted = false
    AND (source = 'ai_discovery' OR source = 'ai' OR enrichment_status = 'pending')
);

-- Delete campaign_contacts links for fake contacts
DELETE FROM campaign_contacts
WHERE contact_id IN (
  SELECT id FROM contacts
  WHERE is_deleted = false
    AND (source = 'ai_discovery' OR source = 'ai' OR enrichment_status = 'pending')
);

-- Delete research briefs linked to fake contacts
DELETE FROM research_briefs
WHERE contact_id IN (
  SELECT id FROM contacts
  WHERE is_deleted = false
    AND (source = 'ai_discovery' OR source = 'ai' OR enrichment_status = 'pending')
);

-- Soft-delete the fake contacts (keep for audit trail)
UPDATE contacts
SET is_deleted = true,
    updated_at = now()
WHERE is_deleted = false
  AND (source = 'ai_discovery' OR source = 'ai' OR enrichment_status = 'pending');

-- Verify
SELECT
  COUNT(*) FILTER (WHERE is_deleted = false) AS "Active contacts remaining",
  COUNT(*) FILTER (WHERE is_deleted = true) AS "Soft-deleted contacts"
FROM contacts;
