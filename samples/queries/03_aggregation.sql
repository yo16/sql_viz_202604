-- 集約関数 + GROUP BY + HAVING
SELECT
  u.user_id,
  u.user_name,
  COUNT(o.order_id) AS order_count,
  SUM(o.total_amount) AS total_spent,
  AVG(o.total_amount) AS avg_order_amount
FROM users AS u
INNER JOIN orders AS o ON u.user_id = o.user_id
WHERE o.order_date >= '2024-01-01'
GROUP BY u.user_id, u.user_name
HAVING COUNT(o.order_id) >= 3
ORDER BY total_spent DESC;
