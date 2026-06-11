-- 20260612_drop_dead_tables.sql
-- 6 tables with 0 rows and 0 code references — dead schema, removing to reduce security surface.

DROP TABLE IF EXISTS public.dodo_payments CASCADE;
DROP TABLE IF EXISTS public.dodo_subscriptions CASCADE;
DROP TABLE IF EXISTS public.quote_requests CASCADE;
DROP TABLE IF EXISTS public.notification_preferences CASCADE;
DROP TABLE IF EXISTS public.contact_messages CASCADE;
DROP TABLE IF EXISTS public.blog_performance CASCADE;
