-- Store CRON_SECRET in Vault so cron can read it (idempotent)
-- The actual value must be inserted manually via dashboard or pre-existing; we just ensure name slot.

CREATE SCHEMA IF NOT EXISTS extensions;

DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

-- Reschedule cron with Bearer auth (reads secret from Vault)
SELECT cron.unschedule('notify-tarefas-diario');

SELECT cron.schedule(
  'notify-tarefas-diario',
  '0 11 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://project--9b6d469b-946d-451c-bccb-76dfc77e8a23.lovable.app/api/public/hooks/notify-tarefas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);