ALTER TABLE members
ADD COLUMN IF NOT EXISTS account_role text NOT NULL DEFAULT 'member'
CHECK (account_role IN ('member', 'auditor', 'treasurer'));

CREATE OR REPLACE VIEW member_summary_view AS
SELECT
  m.id,
  m.employee_id,
  m.full_name,
  m.position,
  m.grade_handled,
  m.contact_number,
  m.address,
  m.date_joined,
  m.status,
  m.share_capital_amount,
  m.total_loans,
  m.total_paid,
  m.remaining_balance,
  m.missed_payments,
  m.total_earnings,
  m.created_at,
  m.updated_at,
  COUNT(l.id) FILTER (WHERE l.status IN ('active', 'delayed')) AS active_loans,
  COUNT(l.id) FILTER (WHERE l.status = 'fully_paid') AS completed_loans,
  m.account_role
FROM members m
LEFT JOIN loans l ON m.id = l.member_id
GROUP BY m.id;
