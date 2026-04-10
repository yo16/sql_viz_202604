-- CTE（WITH句）を使ったクエリ
WITH monthly_sales AS (
  SELECT
    user_id,
    DATE_TRUNC(order_date, MONTH) AS sale_month,
    SUM(total_amount) AS monthly_total
  FROM orders
  WHERE order_date >= '2024-01-01'
  GROUP BY user_id, DATE_TRUNC(order_date, MONTH)
),
ranked_users AS (
  SELECT
    user_id,
    sale_month,
    monthly_total,
    RANK() OVER (PARTITION BY sale_month ORDER BY monthly_total DESC) AS rank
  FROM monthly_sales
)
SELECT
  r.user_id,
  u.user_name,
  r.sale_month,
  r.monthly_total,
  r.rank
FROM ranked_users AS r
INNER JOIN users AS u ON r.user_id = u.user_id
WHERE r.rank <= 10
ORDER BY r.sale_month, r.rank;
