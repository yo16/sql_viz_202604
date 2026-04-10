-- SELECT * のカラム伝播テスト: A→B→C で全段 SELECT *
-- Aのカラムが確定していれば、B, C にも伝播する

-- ステップ1: raw_dataから中間テーブル作成（カラム確定）
CREATE TABLE intermediate AS
SELECT
  user_id,
  user_name,
  email,
  signup_date
FROM raw_data;
