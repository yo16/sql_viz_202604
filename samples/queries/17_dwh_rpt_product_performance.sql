-- DWHシミュレーション: レポート層（商品パフォーマンス）
-- 拡散パターン: mart_customer_orders + stg_orders の両方を参照
-- リネームパターン: item_name→product (stgでリネームされた列をさらにリネーム), product_category→category
CREATE TABLE rpt_product_performance AS
SELECT
  s.product_category AS category,
  s.item_name AS product,
  COUNT(DISTINCT s.order_id) AS order_count,
  SUM(s.quantity) AS total_quantity,
  SUM(s.line_total) AS total_sales,
  COUNT(DISTINCT m.customer_id) AS unique_customers,
  AVG(m.total_revenue) AS avg_customer_revenue
FROM stg_orders AS s
INNER JOIN mart_customer_orders AS m ON s.customer_id = m.customer_id
GROUP BY s.product_category, s.item_name
HAVING SUM(s.line_total) >= 1000
ORDER BY total_sales DESC;
