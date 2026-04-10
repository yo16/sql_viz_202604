-- SELECT t.* で特定テーブルのカラムのみ引き継ぐ
SELECT
  u.*,
  o.order_id,
  o.total_amount
FROM users AS u
INNER JOIN orders AS o ON u.user_id = o.user_id
WHERE o.total_amount > 1000;
