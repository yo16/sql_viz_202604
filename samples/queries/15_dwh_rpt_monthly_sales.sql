-- DWHシミュレーション: レポート層（月次売上）
-- 拡散パターン: mart_customer_orders を参照するレポートの1つ目
-- リネームパターン: region→sales_region, total_revenue→monthly_revenue (集約)
CREATE TABLE rpt_monthly_sales AS
SELECT
  m.region AS sales_region,
  DATE_TRUNC(m.last_order_date, MONTH) AS sales_month,
  COUNT(m.customer_id) AS active_customers,
  SUM(m.total_revenue) AS monthly_revenue,
  AVG(m.total_orders) AS avg_orders_per_customer
FROM mart_customer_orders AS m
WHERE m.total_orders >= 1
GROUP BY m.region, DATE_TRUNC(m.last_order_date, MONTH)
ORDER BY sales_month DESC, monthly_revenue DESC;
