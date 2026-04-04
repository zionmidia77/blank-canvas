
DELETE FROM bot_logs WHERE bot_config_id IN (
  'bce20b92-5385-4715-99d0-658305d99dcc',
  '1e21e46c-8887-4396-8be4-4b02a9ba7b37'
);

DELETE FROM bot_configs WHERE id IN (
  'bce20b92-5385-4715-99d0-658305d99dcc',
  '1e21e46c-8887-4396-8be4-4b02a9ba7b37'
);

DELETE FROM clients WHERE id = '461497fc-2f81-425f-a6d7-ac2d42f3189d';
