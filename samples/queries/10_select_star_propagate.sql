-- SELECT * で前段テーブルの全カラムを引き継ぐ
CREATE TABLE final_output AS
SELECT * FROM intermediate;
