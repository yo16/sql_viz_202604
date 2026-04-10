-- リネージュテスト: ステップ3（rpt_high_value_users作成、mart_user_summaryを参照）
CREATE TABLE rpt_high_value_users AS
SELECT
  m.user_id,
  m.user_name,
  m.user_email,
  m.order_count,
  m.lifetime_value,
  m.first_order_date,
  m.last_order_date,
  CASE
    WHEN m.lifetime_value >= 100000 THEN 'platinum'
    WHEN m.lifetime_value >= 50000 THEN 'gold'
    WHEN m.lifetime_value >= 10000 THEN 'silver'
    ELSE 'bronze'
  END AS user_tier
FROM mart_user_summary AS m
WHERE m.order_count >= 2
ORDER BY m.lifetime_value DESC;
