// =============================================
// WEBHOOK DA EVOLUTION API — implementação completa
// =============================================
//
// CONFIGURAÇÃO NO EVOLUTION API:
//   URL:    https://seu-dominio.com/api/webhook/evolution
//   Eventos: messages.upsert, connection.update
//   Header: x-webhook-secret: <WEBHOOK_SECRET>   (opcional mas recomendado)

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

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface EvolutionWebhookPayload {
  event: string
  instance: string
  data: {
    // connection.update
    state?: "open" | "close" | "connecting"
    // messages.upsert
    key?: {
      remoteJid: string
      fromMe: boolean
      id: string
    }
    pushName?: string
    message?: {
      conversation?: string
      extendedTextMessage?: { text: string }
      imageMessage?: { caption?: string }
      documentMessage?: { caption?: string }
    }
    messageType?: string
    messageTimestamp?: number
  }
}

type ConversationState = "AWAITING_BOOKING" | "AWAITING_CANCEL_CONFIRM" | null

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function normalizePhone(remoteJid: string): string {
  return remoteJid.replace("@s.whatsapp.net", "").replace(/\D/g, "")
}

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

function formatAppointment(a: { startTime: Date; service: { name: string } }): string {
  const dateStr = format(new Date(a.startTime), "EEEE, d 'de' MMMM", { locale: ptBR })
  const timeStr = format(new Date(a.startTime), "HH:mm")
  return `• *${a.service.name}* — ${dateStr} às ${timeStr}`
}

function helpMessage(businessName: string): string {
  return `Olá! Sou o assistente de *${businessName}* 👋\n\nPosso te ajudar com:\n\n1️⃣ *Agendar* um horário\n2️⃣ *Consultar* seus agendamentos\n3️⃣ *Cancelar* um agendamento\n\nÉ só me dizer o que deseja! 😊`
}

function fallbackMessage(businessName: string): string {
  return `Não entendi muito bem 😅\n\nDigite *ajuda* para ver o que posso fazer por você em *${businessName}*!`
}

// ── Handler de conexão (connection.update) ────────────────────────────────────

async function handleConnectionUpdate(payload: EvolutionWebhookPayload) {
  const instanceName = payload.instance
  const state = payload.data.state

  console.log(`[Webhook] connection.update | instance=${instanceName} | state=${state}`)

  // Atualiza o status de conexão no banco
  await prisma.user.updateMany({
    where: { evolutionInstanceName: instanceName },
    data: { evolutionConnected: state === "open" },
  })
}

// ── Handler de mensagem (messages.upsert) ────────────────────────────────────

async function processMessage(payload: EvolutionWebhookPayload): Promise<void> {
  const instanceName = payload.instance
  const key = payload.data.key
  if (!key) return

  const senderPhone = normalizePhone(key.remoteJid)
  const senderName  = payload.data.pushName || "Cliente"
  const text        = extractText(payload)

  const user = await prisma.user.findFirst({
    where: { evolutionInstanceName: instanceName, evolutionConnected: true },
    select: { id: true, name: true, username: true },
  })

  if (!user) {
    console.warn(`[Webhook] Instância "${instanceName}" não associada a nenhum lojista`)
    return
  }

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "https://agendazap.com"
  const bookingUrl = `${appUrl}/${user.username}/book`

  const customer = await prisma.customer.upsert({
    where: { phone_userId: { phone: senderPhone, userId: user.id } },
    update: { name: senderName, lastMessageAt: new Date() },
    create: { name: senderName, phone: senderPhone, userId: user.id, lastMessageAt: new Date() },
  })

  const currentState = customer.conversationState as ConversationState
  const intent       = detectIntent(text)
  const textLower    = text.toLowerCase()

  // Estado: aguardando confirmação de cancelamento
  if (currentState === "AWAITING_CANCEL_CONFIRM") {
    const yes = ["sim", "s", "yes", "confirmar", "pode cancelar", "cancela"].includes(textLower)
    const no  = ["não", "nao", "n", "no", "não cancela", "manter"].includes(textLower)

    if (yes) {
      const next = await prisma.appointment.findFirst({
        where: {
          customerId: customer.id,
          userId: user.id,
          status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
          startTime: { gte: new Date() },
        },
        orderBy: { startTime: "asc" },
        include: { service: true },
      })

      if (next) {
        await prisma.appointment.update({
          where: { id: next.id },
          data: { status: AppointmentStatus.CANCELLED },
        })
        const dateStr = format(new Date(next.startTime), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })
        await sendTextMessage({
          instanceName,
          phoneNumber: senderPhone,
          message: `Seu agendamento de *${next.service.name}* no dia *${dateStr}* foi cancelado. ✅\n\nSe quiser reagendar, é só me dizer!`,
        })
      } else {
        await sendTextMessage({
          instanceName,
          phoneNumber: senderPhone,
          message: "Não encontrei nenhum agendamento ativo para cancelar.",
        })
      }
      await prisma.customer.update({ where: { id: customer.id }, data: { conversationState: null } })
      return
    }

    if (no) {
      await prisma.customer.update({ where: { id: customer.id }, data: { conversationState: null } })
      await sendTextMessage({
        instanceName,
        phoneNumber: senderPhone,
        message: "Ok, seu agendamento foi mantido! 👍\n\nSe precisar de algo mais, é só chamar.",
      })
      return
    }

    await sendTextMessage({
      instanceName,
      phoneNumber: senderPhone,
      message: "Por favor, responda *SIM* para confirmar o cancelamento ou *NÃO* para manter.",
    })
    return
  }

  // Intenções padrão
  if (intent === "GREETING" || intent === "HELP") {
    await sendTextMessage({ instanceName, phoneNumber: senderPhone, message: helpMessage(user.name) })
    return
  }

  if (intent === "UNKNOWN" && currentState === null) {
    await sendTextMessage({ instanceName, phoneNumber: senderPhone, message: helpMessage(user.name) })
    return
  }

  if (intent === "UNKNOWN") {
    await sendTextMessage({ instanceName, phoneNumber: senderPhone, message: fallbackMessage(user.name) })
    return
  }

  if (intent === "BOOK") {
    await sendTextMessage({
      instanceName,
      phoneNumber: senderPhone,
      message: getBookingLinkMessage({ customerName: senderName, bookingUrl, businessName: user.name }),
    })
    await prisma.customer.update({
      where: { id: customer.id },
      data: { conversationState: "AWAITING_BOOKING" },
    })
    return
  }

  if (intent === "STATUS") {
    const upcoming = await prisma.appointment.findMany({
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

    if (upcoming.length === 0) {
      await sendTextMessage({
        instanceName,
        phoneNumber: senderPhone,
        message: `Olá ${senderName}! Você não tem nenhum agendamento ativo em *${user.name}*.\n\nQuer agendar um horário? 😊`,
      })
      return
    }

    const list = upcoming.map(formatAppointment).join("\n")
    await sendTextMessage({
      instanceName,
      phoneNumber: senderPhone,
      message: `Seus próximos agendamentos em *${user.name}*:\n\n${list}\n\nPrecisa de algo mais? 😊`,
    })
    return
  }

  if (intent === "CANCEL") {
    const next = await prisma.appointment.findFirst({
      where: {
        customerId: customer.id,
        userId: user.id,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        startTime: { gte: new Date() },
      },
      orderBy: { startTime: "asc" },
      include: { service: true },
    })

    if (!next) {
      await sendTextMessage({
        instanceName,
        phoneNumber: senderPhone,
        message: `Olá ${senderName}! Não há agendamentos ativos para cancelar em *${user.name}*.`,
      })
      return
    }

    const dateStr = format(new Date(next.startTime), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })
    await sendTextMessage({
      instanceName,
      phoneNumber: senderPhone,
      message: `Você quer cancelar este agendamento?\n\n*${next.service.name}* — ${dateStr}\n\nResponda *SIM* para confirmar ou *NÃO* para manter.`,
    })
    await prisma.customer.update({
      where: { id: customer.id },
      data: { conversationState: "AWAITING_CANCEL_CONFIRM" },
    })
    return
  }
}

// ── Handler POST ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.WEBHOOK_SECRET
    if (secret) {
      const incoming = request.headers.get("x-webhook-secret")
      if (incoming !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const payload: EvolutionWebhookPayload = await request.json()

    // Trata atualização de conexão — atualiza o banco em tempo real
    if (payload.event === "connection.update") {
      await handleConnectionUpdate(payload)
      return NextResponse.json({ success: true })
    }

    // Ignora outros eventos exceto mensagens recebidas
    if (payload.event !== "messages.upsert") {
      return NextResponse.json({ success: true, message: "Evento ignorado" })
    }

    if (payload.data.key?.fromMe) {
      return NextResponse.json({ success: true, message: "Mensagem própria ignorada" })
    }

    processMessage(payload).catch((err) =>
      console.error("[Webhook] Erro ao processar mensagem:", err)
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Webhook] Erro no handler:", error)
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 })
  }
}

// ── Handler GET (health check) ────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Webhook da Evolution API está ativo",
    timestamp: new Date().toISOString(),
  })
}
