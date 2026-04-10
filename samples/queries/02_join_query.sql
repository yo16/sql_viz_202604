-- JOIN付きクエリ（INNER + LEFT）
SELECT
  u.user_id,
  u.user_name,
  o.order_id,
  o.order_date,
  o.total_amount,
  p.product_name
FROM users AS u
INNER JOIN orders AS o ON u.user_id = o.user_id
LEFT JOIN order_items AS oi ON o.order_id = oi.order_id
LEFT JOIN products AS p ON oi.product_id = p.product_id
WHERE o.order_date >= '2024-01-01'
  AND o.total_amount > 1000
ORDER BY o.order_date DESC;
