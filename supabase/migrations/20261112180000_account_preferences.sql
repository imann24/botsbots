-- Per-account defaults for new rooms: the starting bot lineup and room limits.
-- Users read their own row; writes go through authenticated server routes
-- using service credentials, matching how rooms are mutated.
CREATE TABLE public.account_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_bots jsonb NOT NULL CHECK (jsonb_typeof(default_bots) = 'array'),
  default_settings jsonb NOT NULL CHECK (jsonb_typeof(default_settings) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_preferences TO authenticated;
GRANT ALL ON public.account_preferences TO service_role;
CREATE POLICY own_account_preferences ON public.account_preferences FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
COMMENT ON TABLE public.account_preferences IS
  'Defaults applied to new rooms. Validated by the app; unknown models fall back to app defaults.';
