-- DWHシミュレーション: マート層（顧客×注文集約）
-- 収斂パターン: stg_customers + stg_orders → mart_customer_orders
-- リネームパターン: name→display_name, contact_email→email (stgでリネームされた列をさらにリネーム)
CREATE TABLE mart_customer_orders AS
SELECT
  c.customer_id,
  c.name AS display_name,
  c.contact_email AS email,
  c.region,
  COUNT(DISTINCT s.order_id) AS total_orders,
  SUM(s.line_total) AS total_revenue,
  MIN(s.ordered_at) AS first_order_date,
  MAX(s.ordered_at) AS last_order_date,
  COUNT(DISTINCT s.product_category) AS category_count
FROM stg_customers AS c
INNER JOIN stg_orders AS s ON c.customer_id = s.customer_id
GROUP BY c.customer_id, c.name, c.contact_email, c.region;
