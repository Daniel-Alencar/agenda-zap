// =============================================
// GET /api/cron/reminders
// =============================================
// Enviado pela Vercel Cron (ou qualquer scheduler externo) a cada hora.
// Busca agendamentos CONFIRMED que estão entre 23h e 25h no futuro
// e ainda não receberam lembrete, envia a mensagem e marca o campo.
//
// SEGURANÇA:
//   A Vercel assina as chamadas de cron com o header Authorization: Bearer <CRON_SECRET>.
//   Configure CRON_SECRET no painel da Vercel (Settings → Environment Variables).
//   Em desenvolvimento, defina CRON_SECRET="" para desabilitar a verificação.
//
// SCHEDULER EXTERNO (não-Vercel):
//   Chame GET https://seu-dominio.com/api/cron/reminders
//   com o header: Authorization: Bearer <CRON_SECRET>

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendTextMessage, getBookingReminderMessage } from "@/lib/evolution"
import { AppointmentStatus } from "@prisma/client"
import { format, addHours } from "date-fns"
import { ptBR } from "date-fns/locale"

export async function GET(request: NextRequest) {
  // ── Autenticação do cron ────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const now = new Date()

  // Janela: agendamentos com startTime entre 23h e 25h a partir de agora.
  // Rodar o cron a cada hora garante que todo agendamento seja capturado
  // independente de quando exatamente o cron executa dentro da hora.
  const windowStart = addHours(now, 23)
  const windowEnd   = addHours(now, 25)

  console.log(
    `[Cron/Reminders] Executando às ${now.toISOString()} | janela: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`
  )

  // ── Busca agendamentos elegíveis ────────────────────────────────────────────
  const appointments = await prisma.appointment.findMany({
    where: {
      status:        AppointmentStatus.CONFIRMED,
      reminderSentAt: null,                       // ainda não enviou lembrete
      startTime: {
        gte: windowStart,
        lte: windowEnd,
      },
      user: {
        evolutionConnected:    true,
        evolutionInstanceName: { not: null },
      },
    },
    select: {
      id:        true,
      startTime: true,
      user: {
        select: {
          name:                  true,
          evolutionInstanceName: true,
        },
      },
      customer: {
        select: {
          name:  true,
          phone: true,
        },
      },
      service: {
        select: { name: true },
      },
    },
  })

  console.log(`[Cron/Reminders] ${appointments.length} agendamento(s) para notificar`)

  if (appointments.length === 0) {
    return NextResponse.json({ sent: 0, message: "Nenhum lembrete pendente." })
  }

  // ── Envia e registra cada lembrete ─────────────────────────────────────────
  const results = await Promise.allSettled(
    appointments.map(async (apt) => {
      const instanceName = apt.user.evolutionInstanceName!
      const time         = format(new Date(apt.startTime), "HH:mm")

      const message = getBookingReminderMessage({
        customerName: apt.customer.name.split(" ")[0],
        serviceName:  apt.service.name,
        time,
        businessName: apt.user.name,
      })

      // Envia a mensagem
      const result = await sendTextMessage({
        instanceName,
        phoneNumber: apt.customer.phone,
        message,
      })

      if (!result.success) {
        throw new Error(
          `Falha ao enviar para ${apt.customer.phone} (appointment ${apt.id})`
        )
      }

      // Marca como enviado — mesmo se o sendTextMessage falhar e for retentado,
      // nunca reenvia para o mesmo agendamento
      await prisma.appointment.update({
        where: { id: apt.id },
        data:  { reminderSentAt: new Date() },
      })

      console.log(
        `[Cron/Reminders] Lembrete enviado → ${apt.customer.name} (${apt.customer.phone}) | ${apt.service.name} às ${time}`
      )

      return apt.id
    })
  )

  const sent   = results.filter((r) => r.status === "fulfilled").length
  const failed = results.filter((r) => r.status === "rejected")

  if (failed.length > 0) {
    failed.forEach((f) => {
      if (f.status === "rejected") {
        console.error("[Cron/Reminders] Erro:", f.reason)
      }
    })
  }

  console.log(`[Cron/Reminders] Concluído: ${sent} enviados, ${failed.length} falhas`)

  return NextResponse.json({
    sent,
    failed: failed.length,
    total:  appointments.length,
  })
}
