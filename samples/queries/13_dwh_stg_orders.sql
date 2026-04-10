-- DWHシミュレーション: ステージング層（注文）
-- 収斂パターン: raw_orders + raw_order_items + raw_products → stg_orders
-- リネームパターン: order_date→ordered_at, order_status→status, product_name→item_name
CREATE TABLE stg_orders AS
SELECT
  o.order_id,
  o.customer_id,
  o.order_date AS ordered_at,
  o.order_status AS status,
  oi.product_id,
  p.product_name AS item_name,
  p.category AS product_category,
  oi.quantity,
  oi.unit_price,
  oi.quantity * oi.unit_price AS line_total
FROM raw_orders AS o
INNER JOIN raw_order_items AS oi ON o.order_id = oi.order_id
INNER JOIN raw_products AS p ON oi.product_id = p.product_id
WHERE o.order_date >= '2024-01-01';
