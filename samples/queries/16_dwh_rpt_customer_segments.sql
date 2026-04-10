-- DWHシミュレーション: レポート層（顧客セグメント）
-- 拡散パターン: mart_customer_orders を参照するレポートの2つ目
-- リネームパターン: display_name→customer_name (元の名前に戻す), total_revenue→spend
CREATE TABLE rpt_customer_segments AS
SELECT
  m.customer_id,
  m.display_name AS customer_name,
  m.email AS contact,
  m.region,
  m.total_orders AS order_count,
  m.total_revenue AS spend,
  CASE
    WHEN m.total_revenue >= 100000 THEN 'VIP'
    WHEN m.total_revenue >= 50000 THEN 'Gold'
    WHEN m.total_revenue >= 10000 THEN 'Silver'
    ELSE 'Bronze'
  END AS customer_tier,
  CASE
    WHEN m.category_count >= 5 THEN 'Multi-category'
    WHEN m.category_count >= 2 THEN 'Cross-category'
    ELSE 'Single-category'
  END AS shopping_pattern
FROM mart_customer_orders AS m
WHERE m.total_orders >= 2;
