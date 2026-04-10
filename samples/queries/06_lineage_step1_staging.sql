-- リネージュテスト: ステップ1（stg_orders中間テーブル作成）
CREATE TABLE stg_orders AS
SELECT
  o.order_id,
  o.user_id,
  o.order_date,
  o.total_amount,
  u.user_name,
  u.email AS user_email
FROM raw_orders AS o
INNER JOIN raw_users AS u ON o.user_id = u.user_id
WHERE o.order_date >= '2024-01-01';
