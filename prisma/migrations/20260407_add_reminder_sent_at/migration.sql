-- Adiciona campo para controle de lembretes automáticos
-- Null = lembrete ainda não enviado
-- Preenchido com o timestamp do envio para evitar duplicatas

ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);

-- Índice para a query do cron: busca agendamentos no dia seguinte sem lembrete enviado
CREATE INDEX IF NOT EXISTS "Appointment_reminderSentAt_idx" ON "Appointment"("reminderSentAt");
