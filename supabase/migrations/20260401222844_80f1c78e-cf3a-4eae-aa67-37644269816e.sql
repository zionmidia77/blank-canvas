ALTER TABLE public.bot_configs ADD COLUMN IF NOT EXISTS bot_id text UNIQUE;

-- Set default bot_id for existing rows based on bot_type
UPDATE public.bot_configs SET bot_id = COALESCE(bot_type, 'messaging') || '_' || LEFT(id::text, 8) WHERE bot_id IS NULL;