// =============================================
// WEBHOOK DA EVOLUTION API — implementação completa
// =============================================
//
// CONFIGURAÇÃO NO EVOLUTION API:
//   URL:    https://seu-dominio.com/api/webhook/evolution
//   Evento: messages.upsert
//   Header: x-webhook-secret: <WEBHOOK_SECRET>   (opcional mas recomendado)
//
// FLUXO PRINCIPAL:
//   1. Cliente manda qualquer mensagem
//   2. Sistema identifica a intenção (agendar | consultar | cancelar | ajuda)
//   3. Responde com a ação adequada
//
// ESTADOS DA CONVERSA (Customer.conversationState):
//   null                    → nenhum fluxo ativo
//   "AWAITING_BOOKING"      → link de agendamento enviado, aguardando retorno
//   "AWAITING_CANCEL_CONFIRM" → listou agendamentos, aguardando "SIM" para cancelar

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  sendTextMessage,
  getBookingLinkMessage,
  getBookingConfirmationMessage,
} from "@/lib/evolution"
import { AppointmentStatus } from "@prisma/client"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

// =============================================
// TIPOS
// =============================================
interface EvolutionWebhookPayload {
  event: string
  instance: string
  data: {
    key: {
      remoteJid: string
      fromMe: boolean
      id: string
    }
    pushName: string
    message?: {
      conversation?: string
      extendedTextMessage?: { text: string }
      imageMessage?: { caption?: string }
      documentMessage?: { caption?: string }
    }
    messageType: string
    messageTimestamp: number
  }
}

type ConversationState = "AWAITING_BOOKING" | "AWAITING_CANCEL_CONFIRM" | null

// =============================================
// HELPERS
// =============================================

/** Extrai o texto da mensagem independente do tipo */
function extractText(payload: EvolutionWebhookPayload): string {
  const msg = payload.data.message
  if (!msg) return ""
  return (
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    msg.imageMessage?.caption ??
    msg.documentMessage?.caption ??
    ""
  ).trim()
}

/** Normaliza número: remove @s.whatsapp.net e garante só dígitos */
function normalizePhone(remoteJid: string): string {
  return remoteJid.replace("@s.whatsapp.net", "").replace(/\D/g, "")
}

/** Detecta intenção pela mensagem */
function detectIntent(text: string): "BOOK" | "STATUS" | "CANCEL" | "HELP" | "GREETING" | "UNKNOWN" {
  const lower = text.toLowerCase()

  const greetings = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "opa", "ei"]
  if (greetings.some((g) => lower === g || lower.startsWith(g + " "))) return "GREETING"

  const bookKeywords = ["agendar", "agenda", "horário", "horario", "marcar", "disponível",
    "disponivel", "atendimento", "reservar", "quero agendar", "quero marcar"]
  if (bookKeywords.some((k) => lower.includes(k))) return "BOOK"

  const statusKeywords = ["meu agendamento", "meus agendamentos", "minha consulta",
    "quando é", "quando e", "confirmar", "confirmado", "agendei"]
  if (statusKeywords.some((k) => lower.includes(k))) return "STATUS"

  const cancelKeywords = ["cancelar", "cancela", "desmarcar", "desmarca", "não vou", "nao vou"]
  if (cancelKeywords.some((k) => lower.includes(k))) return "CANCEL"

  const helpKeywords = ["ajuda", "help", "menu", "opções", "opcoes", "o que você faz", "como funciona"]
  if (helpKeywords.some((k) => lower.includes(k))) return "HELP"

  return "UNKNOWN"
}

/** Formata data/hora de um agendamento para português */
function formatAppointment(a: {
  startTime: Date
  service: { name: string }
}): string {
  const dateStr = format(new Date(a.startTime), "EEEE, d 'de' MMMM", { locale: ptBR })
  const timeStr = format(new Date(a.startTime), "HH:mm")
  return `• *${a.service.name}* — ${dateStr} às ${timeStr}`
}

/** Mensagem de menu/ajuda */
function helpMessage(businessName: string): string {
  return `Olá! Sou o assistente de *${businessName}* 👋

Posso te ajudar com:

1️⃣ *Agendar* um horário
2️⃣ *Consultar* seus agendamentos
3️⃣ *Cancelar* um agendamento

É só me dizer o que deseja! 😊`
}

/** Mensagem padrão quando não entende */
function fallbackMessage(businessName: string): string {
  return `Não entendi muito bem 😅

Digite *ajuda* para ver o que posso fazer por você em *${businessName}*!`
}

// =============================================
// LÓGICA PRINCIPAL DO WEBHOOK
// =============================================
async function processMessage(payload: EvolutionWebhookPayload): Promise<void> {
  const instanceName = payload.instance
  const senderPhone = normalizePhone(payload.data.key.remoteJid)
  const senderName = payload.data.pushName || "Cliente"
  const text = extractText(payload)

  // 1. Busca o lojista pela instância da Evolution API
  const user = await prisma.user.findFirst({
    where: { evolutionInstanceName: instanceName, evolutionConnected: true },
    select: { id: true, name: true, username: true },
  })

  if (!user) {
    console.warn(`[Webhook] Instância "${instanceName}" não associada a nenhum lojista`)
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://agendazap.com"
  const bookingUrl = `${appUrl}/${user.username}/book`

  // 2. Busca ou cria o cliente no banco (upsert)
  const customer = await prisma.customer.upsert({
    where: { phone_userId: { phone: senderPhone, userId: user.id } },
    update: { name: senderName, lastMessageAt: new Date() },
    create: {
      name: senderName,
      phone: senderPhone,
      userId: user.id,
      lastMessageAt: new Date(),
    },
  })

  const currentState = customer.conversationState as ConversationState

  // 3. Detecta intenção
  const intent = detectIntent(text)
  const textLower = text.toLowerCase()

  // ------------------------------------------------
  // 3a. Estado: aguardando confirmação de cancelamento
  // ------------------------------------------------
  if (currentState === "AWAITING_CANCEL_CONFIRM") {
    const confirmedYes = ["sim", "s", "yes", "confirmar", "pode cancelar", "cancela"].includes(textLower)
    const confirmedNo = ["não", "nao", "n", "no", "não cancela", "manter"].includes(textLower)

    if (confirmedYes) {
      // Cancela o próximo agendamento ativo do cliente
      const nextAppointment = await prisma.appointment.findFirst({
        where: {
          customerId: customer.id,
          userId: user.id,
          status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
          startTime: { gte: new Date() },
        },
        orderBy: { startTime: "asc" },
        include: { service: true },
      })

      if (nextAppointment) {
        await prisma.appointment.update({
          where: { id: nextAppointment.id },
          data: { status: AppointmentStatus.CANCELLED },
        })

        const dateStr = format(new Date(nextAppointment.startTime), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })
        await sendTextMessage({
          instanceName,
          phoneNumber: senderPhone,
          message: `Seu agendamento de *${nextAppointment.service.name}* no dia *${dateStr}* foi cancelado. ✅\n\nSe quiser reagendar, é só me dizer!`,
        })
      } else {
        await sendTextMessage({
          instanceName,
          phoneNumber: senderPhone,
          message: "Não encontrei nenhum agendamento ativo para cancelar.",
        })
      }

      // Limpa o estado
      await prisma.customer.update({
        where: { id: customer.id },
        data: { conversationState: null },
      })
      return
    }

    if (confirmedNo) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { conversationState: null },
      })
      await sendTextMessage({
        instanceName,
        phoneNumber: senderPhone,
        message: "Ok, seu agendamento foi mantido! 👍\n\nSe precisar de algo mais, é só chamar.",
      })
      return
    }

    // Resposta inválida — pede para confirmar novamente
    await sendTextMessage({
      instanceName,
      phoneNumber: senderPhone,
      message: 'Por favor, responda *SIM* para confirmar o cancelamento ou *NÃO* para manter o agendamento.',
    })
    return
  }

  // ------------------------------------------------
  // 3b. Intenções padrão
  // ------------------------------------------------

  if (intent === "GREETING" || intent === "HELP" || intent === "UNKNOWN") {
    // Se nunca interagiu ou está pedindo ajuda, envia o menu
    if (intent === "UNKNOWN" && currentState === null) {
      // Primeira mensagem genérica — envia boas-vindas + menu
      await sendTextMessage({
        instanceName,
        phoneNumber: senderPhone,
        message: helpMessage(user.name),
      })
      return
    }

    if (intent === "HELP" || intent === "GREETING") {
      await sendTextMessage({
        instanceName,
        phoneNumber: senderPhone,
        message: helpMessage(user.name),
      })
      return
    }

    // Intent UNKNOWN com estado ativo — fallback
    await sendTextMessage({
      instanceName,
      phoneNumber: senderPhone,
      message: fallbackMessage(user.name),
    })
    return
  }

  if (intent === "BOOK") {
    const message = getBookingLinkMessage({
      customerName: senderName,
      bookingUrl,
      businessName: user.name,
    })

    await sendTextMessage({ instanceName, phoneNumber: senderPhone, message })

    // Registra estado para saber que enviamos o link
    await prisma.customer.update({
      where: { id: customer.id },
      data: { conversationState: "AWAITING_BOOKING" },
    })
    return
  }

  if (intent === "STATUS") {
    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        customerId: customer.id,
        userId: user.id,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        startTime: { gte: new Date() },
      },
      include: { service: true },
      orderBy: { startTime: "asc" },
      take: 3,
    })

    if (upcomingAppointments.length === 0) {
      await sendTextMessage({
        instanceName,
        phoneNumber: senderPhone,
        message: `Olá ${senderName}! Você não tem nenhum agendamento ativo em *${user.name}*.\n\nQuer agendar um horário? É só me dizer! 😊`,
      })
      return
    }

    const list = upcomingAppointments.map(formatAppointment).join("\n")
    await sendTextMessage({
      instanceName,
      phoneNumber: senderPhone,
      message: `Seus próximos agendamentos em *${user.name}*:\n\n${list}\n\nPrecisa de algo mais? 😊`,
    })
    return
  }

  if (intent === "CANCEL") {
    const nextAppointment = await prisma.appointment.findFirst({
      where: {
        customerId: customer.id,
        userId: user.id,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        startTime: { gte: new Date() },
      },
      orderBy: { startTime: "asc" },
      include: { service: true },
    })

    if (!nextAppointment) {
      await sendTextMessage({
        instanceName,
        phoneNumber: senderPhone,
        message: `Olá ${senderName}! Não encontrei nenhum agendamento ativo para cancelar em *${user.name}*.`,
      })
      return
    }

    const dateStr = format(
      new Date(nextAppointment.startTime),
      "EEEE, d 'de' MMMM 'às' HH:mm",
      { locale: ptBR }
    )

    await sendTextMessage({
      instanceName,
      phoneNumber: senderPhone,
      message: `Você quer cancelar este agendamento?\n\n*${nextAppointment.service.name}* — ${dateStr}\n\nResponda *SIM* para confirmar o cancelamento ou *NÃO* para mantê-lo.`,
    })

    await prisma.customer.update({
      where: { id: customer.id },
      data: { conversationState: "AWAITING_CANCEL_CONFIRM" },
    })
    return
  }
}

// =============================================
// HANDLER POST
// =============================================
export async function POST(request: NextRequest) {
  try {
    // Validação de segredo (opcional — configure WEBHOOK_SECRET no .env)
    const secret = process.env.WEBHOOK_SECRET
    if (secret) {
      const incoming = request.headers.get("x-webhook-secret")
      if (incoming !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const payload: EvolutionWebhookPayload = await request.json()

    // Só processa eventos de mensagens recebidas
    if (payload.event !== "messages.upsert") {
      return NextResponse.json({ success: true, message: "Evento ignorado" })
    }

    // Ignora mensagens enviadas pelo próprio bot
    if (payload.data.key.fromMe) {
      return NextResponse.json({ success: true, message: "Mensagem própria ignorada" })
    }

    // Processa de forma assíncrona — responde 200 imediatamente para a Evolution API
    // (ela pode reenviar se demorar demais)
    processMessage(payload).catch((err) =>
      console.error("[Webhook] Erro ao processar mensagem:", err)
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Webhook] Erro no handler:", error)
    return NextResponse.json(
      { success: false, error: "Erro interno" },
      { status: 500 }
    )
  }
}

// =============================================
// HANDLER GET — health check
// =============================================
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Webhook da Evolution API está ativo",
    timestamp: new Date().toISOString(),
  })
}
