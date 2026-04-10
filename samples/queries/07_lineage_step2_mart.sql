-- リネージュテスト: ステップ2（mart_user_summary作成、stg_ordersを参照）
CREATE TABLE mart_user_summary AS
SELECT
  s.user_id,
  s.user_name,
  s.user_email,
  COUNT(s.order_id) AS order_count,
  SUM(s.total_amount) AS lifetime_value,
  MIN(s.order_date) AS first_order_date,
  MAX(s.order_date) AS last_order_date
FROM stg_orders AS s
GROUP BY s.user_id, s.user_name, s.user_email;
