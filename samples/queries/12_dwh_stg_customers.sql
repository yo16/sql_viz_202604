-- DWHシミュレーション: ステージング層（顧客）
-- raw_customers → stg_customers
-- リネームパターン: customer_name→name, email→contact_email, registered_at→signup_date
CREATE TABLE stg_customers AS
SELECT
  c.customer_id,
  c.customer_name AS name,
  c.email AS contact_email,
  c.region,
  c.registered_at AS signup_date
FROM raw_customers AS c
WHERE c.is_active = true;
