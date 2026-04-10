-- サブクエリ（FROM句 + WHERE句）
SELECT
  u.user_id,
  u.user_name,
  u.email,
  recent.last_order_date,
  recent.last_amount
FROM users AS u
INNER JOIN (
  SELECT
    user_id,
    MAX(order_date) AS last_order_date,
    MAX(total_amount) AS last_amount
  FROM orders
  GROUP BY user_id
) AS recent ON u.user_id = recent.user_id
WHERE u.user_id IN (
  SELECT DISTINCT user_id
  FROM orders
  WHERE total_amount > 5000
)
ORDER BY recent.last_order_date DESC;
