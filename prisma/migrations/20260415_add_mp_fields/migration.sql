-- Adiciona campos do Mercado Pago que estão no schema mas faltam no banco
-- Execute com: npx prisma migrate deploy
-- Ou diretamente no Supabase SQL Editor

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "mpCustomerId"    TEXT,
  ADD COLUMN IF NOT EXISTS "pendingPlanType" "PlanType";
