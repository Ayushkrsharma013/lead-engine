-- 20260612_drop_paddle_tables.sql
-- Paddle tables are dead — we use Dodo Payments.
-- Dropping removes unused security surface.

DROP TABLE IF EXISTS public.paddle_subscriptions CASCADE;
DROP TABLE IF EXISTS public.paddle_transactions CASCADE;
