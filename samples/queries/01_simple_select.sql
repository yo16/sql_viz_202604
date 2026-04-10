-- シンプルなSELECT文
SELECT
  user_id,
  user_name,
  email,
  created_at
FROM users
WHERE created_at >= '2024-01-01'
ORDER BY created_at DESC;
