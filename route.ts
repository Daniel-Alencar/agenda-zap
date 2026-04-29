import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendTextMessage, getBookingLinkMessage } from "@/lib/evolution"
import { AppointmentStatus } from "@prisma/client"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface MessageData {
  key: { remoteJid: string; fromMe: boolean; id: string; senderPn?: string }
  pushName?: string
  // senderPn pode vir na raiz do objeto (v2) em vez de dentro de key
  senderPn?: string
  message?: {
    conversation?: string
    extendedTextMessage?: { text: string }
    imageMessage?: { caption?: string }
    documentMessage?: { caption?: string }
  }
  messageType?: string
  messageTimestamp?: number
}

interface EvolutionWebhookPayload {
  event: string
  instance: string
  // senderPn pode estar na raiz de data (Evolution API v2)
  data: {
    state?: "open" | "close" | "connecting"
    senderPn?: string
    // Forma A (v1): campos direto em data
    key?: MessageData["key"]
    pushName?: string
    message?: MessageData["message"]
    messageType?: string
    messageTimestamp?: number
    // Forma B (v2): array de mensagens
    messages?: MessageData[]
  }
}

// Estados da conversa
// null            → cliente nunca interagiu ou estado expirou → envia menu
// "MENU"          → menu foi enviado, aguardando 1, 2 ou 3
// "AWAITING_BOOKING"        → link de agendamento enviado, aguardando o cliente agendar
// "AWAITING_CANCEL_CONFIRM" → perguntou se confirma cancelamento, aguardando 1 ou 2
type ConversationState =
  | null
  | "MENU"
  | "AWAITING_BOOKING"
  | "AWAITING_CANCEL_CONFIRM"

// ── Deduplicação de mensagens ─────────────────────────────────────────────────
// A Evolution API pode enviar o mesmo webhook mais de uma vez.
// Usamos um cache em memória com TTL para ignorar duplicatas.
// A limpeza é feita de forma lazy (dentro de isDuplicate) para evitar
// setInterval no nível do módulo, que causa crash no Turbopack.

const processedMessages = new Map<string, number>()
const DEDUP_TTL_MS = 60_000 // 1 minuto
const DEDUP_MAX_SIZE = 500  // limpa quando passar deste tamanho
let lastCleanup = Date.now()

function isDuplicate(messageId: string): boolean {
  const now = Date.now()

  // Limpeza lazy: a cada 60s OU quando o Map ficar grande demais
  if (now - lastCleanup > DEDUP_TTL_MS || processedMessages.size > DEDUP_MAX_SIZE) {
    for (const [id, ts] of processedMessages) {
      if (now - ts > DEDUP_TTL_MS) processedMessages.delete(id)
    }
    lastCleanup = now
  }

  if (processedMessages.has(messageId)) return true
  processedMessages.set(messageId, now)
  return false
}

// ── Tipos de mensagem que devem ser IGNORADOS ────────────────────────────────
// São mensagens de protocolo, status ou interações que não são texto do cliente.
const IGNORED_MESSAGE_TYPES = new Set([
  "protocolMessage",
  "senderKeyDistributionMessage",
  "messageContextInfo",
  "reactionMessage",
  "pollCreationMessage",
  "pollUpdateMessage",
  "ephemeralMessage",
  "viewOnceMessage",
  "viewOnceMessageV2",
  "stickerMessage",
  "locationMessage",
  "liveLocationMessage",
  "contactMessage",
  "contactsArrayMessage",
  "callLogMessage",
  "statusMessage",
])

// ── Normalização do payload (v1 e v2 da Evolution API) ────────────────────────

function extractMessageData(payload: EvolutionWebhookPayload): MessageData | null {
  let data: MessageData | null = null

  // Forma B: data.messages é um array (Evolution API v2)
  if (Array.isArray(payload.data.messages) && payload.data.messages.length > 0) {
    data = payload.data.messages[0]
  }
  // Forma A: key está diretamente em data (Evolution API v1 / alguns eventos v2)
  else if (payload.data.key) {
    data = {
      key:              payload.data.key,
      pushName:         payload.data.pushName,
      message:          payload.data.message,
      messageType:      payload.data.messageType,
      messageTimestamp: payload.data.messageTimestamp,
    }
  }

  if (!data?.key) {
    console.warn("[Webhook] Payload sem key — ignorando", JSON.stringify(payload.data).slice(0, 300))
    return null
  }

  // Propaga o senderPn para dentro de data se veio na raiz do payload
  // Evolution API v2 coloca senderPn em data (raiz), não dentro de key
  if (!data.senderPn && !data.key.senderPn && payload.data.senderPn) {
    data.senderPn = payload.data.senderPn
  }

  // Precisamos de ao menos remoteJid OU senderPn para identificar o remetente
  const jid = data.key.remoteJid ?? ""
  const senderPn = data.senderPn ?? data.key.senderPn ?? ""

  if (!jid && !senderPn) {
    console.warn("[Webhook] Sem remoteJid e sem senderPn — ignorando")
    return null
  }

  // Ignora grupos e broadcasts usando remoteJid (campo sempre presente)
  if (
    jid.endsWith("@g.us") ||
    jid.endsWith("@broadcast") ||
    jid.includes("status@broadcast")
  ) {
    return null
  }

  // Ignora tipos de mensagem que não são interações do cliente
  const msgType = data.messageType ?? ""
  if (msgType && IGNORED_MESSAGE_TYPES.has(msgType)) {
    console.log(`[Webhook] Tipo de mensagem ignorado: ${msgType}`)
    return null
  }

  return data
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractText(data: MessageData): string {
  const msg = data.message
  if (!msg) return ""
  return (
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    msg.imageMessage?.caption ??
    msg.documentMessage?.caption ??
    ""
  ).trim()
}

function extractPhone(data: MessageData): string {
  // Prioridade: senderPn (número limpo, sem @) > remoteJid (contém @s.whatsapp.net)
  // senderPn pode estar em data.senderPn (v2) ou data.key.senderPn (v1)
  const raw = data.senderPn ?? data.key.senderPn ?? data.key.remoteJid ?? "";
  let phone = raw
    .replace("@s.whatsapp.net", "")
    .replace("@lid", "")  // LID-based JIDs (Evolution API 2.3.7+)
    .replace(/\D/g, "");

  // Regra para o 9º dígito brasileiro:
  // Se começa com 55 e tem 12 dígitos (ex: 558791459881 sem o 9 extra),
  // nós inserimos o '9' após o DDI (55) e DDD.
  if (phone.startsWith("55") && phone.length === 12) {
    phone = phone.slice(0, 4) + "9" + phone.slice(4);
  }

  console.log(`[Webhook] extractPhone: raw="${raw}" → phone="${phone}"`);

  return phone;
}


function isStateExpired(lastMessageAt: Date | null): boolean {
  if (!lastMessageAt) return true
  const TIMEOUT_MS = 30 * 60 * 1000 // 30 minutos sem interação → reset
  return Date.now() - new Date(lastMessageAt).getTime() > TIMEOUT_MS
}

function formatAppointmentLine(a: { startTime: Date; service: { name: string } }): string {
  const date = format(new Date(a.startTime), "EEE dd/MM", { locale: ptBR })
  const time = format(new Date(a.startTime), "HH:mm")
  return `• *${a.service.name}* — ${date} às ${time}`
}

// ── Interpreta a entrada do usuário ──────────────────────────────────────────
// Prioridade: número digitado > palavra-chave > nada reconhecido

type MenuChoice = "1" | "2" | "3" | "MENU" | null

function parseInput(text: string): MenuChoice {
  const t = text.trim()

  // Número exato
  if (t === "1") return "1"
  if (t === "2") return "2"
  if (t === "3") return "3"

  // Palavras-chave como fallback (para quem digitar texto em vez de número)
  const lower = t.toLowerCase()
  if (/agendar|agenda|horário|horario|marcar|reservar/.test(lower)) return "1"
  if (/agendamento|consultar|meu horário|quando|ver/.test(lower))   return "2"
  if (/cancelar|cancela|desmarcar|desmarca/.test(lower))            return "3"

  // Pedido de menu / saudação
  if (/menu|ajuda|help|oi|olá|ola|bom dia|boa tarde|boa noite|início|inicio/.test(lower)) return "MENU"

  return null
}

// ── Textos das mensagens ──────────────────────────────────────────────────────

function menuText(businessName: string, firstName: string): string {
  return (
    `Olá, *${firstName}*! 👋\n` +
    `Bem-vindo(a) a *${businessName}*.\n\n` +
    `O que você precisa?\n\n` +
    `*1* — Agendar um horário\n` +
    `*2* — Ver meus agendamentos\n` +
    `*3* — Cancelar um agendamento\n\n` +
    `_Responda com o número da opção._`
  )
}

function menuReturnText(): string {
  return (
    `O que mais posso fazer?\n\n` +
    `*1* — Agendar um horário\n` +
    `*2* — Ver meus agendamentos\n` +
    `*3* — Cancelar um agendamento`
  )
}

function invalidOptionText(): string {
  return (
    `Não entendi 😅\n\n` +
    `Por favor, responda com o número:\n` +
    `*1* — Agendar\n` +
    `*2* — Ver agendamentos\n` +
    `*3* — Cancelar`
  )
}

// ── Handler de conexão ────────────────────────────────────────────────────────

async function handleConnectionUpdate(payload: EvolutionWebhookPayload) {
  const { instance: instanceName, data } = payload
  console.log(`[Webhook] connection.update | ${instanceName} | state=${data.state}`)
  await prisma.user.updateMany({
    where: { evolutionInstanceName: instanceName },
    data:  { evolutionConnected: data.state === "open" },
  })
}

// ── Processamento da mensagem ─────────────────────────────────────────────────

async function processMessage(instanceName: string, msgData: MessageData): Promise<void> {
  const senderPhone = extractPhone(msgData)
  const senderName  = msgData.pushName || "Cliente"
  const firstName   = senderName.split(" ")[0]
  const text        = extractText(msgData)

  console.log(`[Webhook] ${senderName} (${senderPhone}): "${text}"`)

  // 1. Busca o lojista pela instância.
  // NÃO filtramos por evolutionConnected: true — esse campo no banco pode estar
  // desatualizado se o lojista não abriu o dashboard recentemente (o polling que
  // sincroniza esse campo só roda enquanto o dashboard está aberto). 
  // O que realmente
  // importa é que a mensagem chegou via webhook, o que por si só prova que a
  // instância está ativa na Evolution API.
  const user = await prisma.user.findFirst({
    where: { evolutionInstanceName: instanceName },
    select: { id: true, name: true, username: true },
  })
  if (!user) {
    console.warn(`[Webhook] Instância "${instanceName}" sem lojista vinculado`)
    return
  }

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const bookingUrl = `${appUrl}/${user.username}/book`

  // 2. Localiza o cliente (sem atualizar ainda — precisamos ler o estado antes).
  // Busca tolerando variação de DDI (com e sem prefixo 55).
  const phoneAlt = senderPhone.startsWith("55") ? senderPhone.slice(2) : `55${senderPhone}`
  const existing = await prisma.customer.findFirst({
    where: { userId: user.id, phone: { in: [senderPhone, phoneAlt] } },
  })

  // 3. Lê o estado ANTES de atualizar lastMessageAt.
  // Se isStateExpired usasse o lastMessageAt já atualizado para "agora",
  // o timeout de 30 min nunca funcionaria. Além disso, em mensagens enviadas
  // rapidamente em sequência, atualizar o campo antes de ler causava race condition:
  // duas chamadas paralelas ao processMessage liam estados inconsistentes.
  const rawState = (existing?.conversationState ?? null) as ConversationState
  const expired  = isStateExpired(existing?.lastMessageAt ?? null)
  const currentState: ConversationState = expired ? null : rawState

  // Agora sim: cria ou atualiza o cliente com o lastMessageAt correto
  const customer = existing
    ? await prisma.customer.update({
        where: { id: existing.id },
        data:  {
          name:          senderName,
          phone:         senderPhone,
          lastMessageAt: new Date(),
          // Limpa o estado expirado diretamente no update, evitando um segundo round-trip
          ...(rawState !== null && expired ? { conversationState: null } : {}),
        },
      })
    : await prisma.customer.create({
        data: { name: senderName, phone: senderPhone, userId: user.id, lastMessageAt: new Date() },
      })

  const input    = parseInput(text)
  const textLower = text.trim().toLowerCase()

  // Helper para salvar o estado e enviar mensagem
  async function reply(message: string, nextState: ConversationState = null) {
    await sendTextMessage({ instanceName, phoneNumber: senderPhone, message })
    await prisma.customer.update({ where: { id: customer.id }, data: { conversationState: nextState } })
  }

  // ── 4. Máquina de estados ─────────────────────────────────────────────────

  // ── Estado: aguardando SIM/NÃO para confirmar cancelamento ────────────────
  if (currentState === "AWAITING_CANCEL_CONFIRM") {
    const yes = ["sim", "s", "1", "yes"].includes(textLower)
    const no  = ["não", "nao", "n", "2", "no"].includes(textLower)

    if (yes) {
      const next = await prisma.appointment.findFirst({
        where: {
          customerId: customer.id,
          userId:     user.id,
          status:     { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
          startTime:  { gte: new Date() },
        },
        orderBy: { startTime: "asc" },
        include: { service: true },
      })

      if (next) {
        await prisma.appointment.update({ where: { id: next.id }, data: { status: AppointmentStatus.CANCELLED } })

        // Notifica o lojista no painel
        prisma.notification.create({
          data: {
            type:          "BOOKING_CANCELLED",
            title:         "Agendamento cancelado",
            body:          `${senderName} cancelou ${next.service.name} de ${format(new Date(next.startTime), "d/MM 'às' HH:mm")}.`,
            userId:        user.id,
            appointmentId: next.id,
          },
        }).catch(
          (err) => console.error("[Webhook] Falha ao criar notificação:", err)
        )

        const dateStr = format(new Date(next.startTime), "d/MM 'às' HH:mm")
        await sendTextMessage({
          instanceName, phoneNumber: senderPhone,
          message: `✅ *${next.service.name}* em ${dateStr} foi cancelado.\n\n` + menuReturnText(),
        })
      } else {
        await sendTextMessage({
          instanceName, phoneNumber: senderPhone,
          message: `Não encontrei agendamentos ativos para cancelar.\n\n` + menuReturnText(),
        })
      }
      await prisma.customer.update({ where: { id: customer.id }, data: { conversationState: "MENU" } })
      return
    }

    if (no) {
      await reply(`👍 Agendamento mantido!\n\n` + menuReturnText(), "MENU")
      return
    }

    // Resposta não reconhecida dentro deste estado
    await sendTextMessage({
      instanceName, phoneNumber: senderPhone,
      message: `Responda:\n*1* — Sim, cancelar\n*2* — Não, manter`,
    })
    return
  }

  // ── Estado: link de agendamento enviado, aguardando o cliente agendar ──────
  if (currentState === "AWAITING_BOOKING") {
    if (input !== null && input !== "MENU") {
      // Cliente escolheu outra opção → sai do estado e processa normalmente
      await prisma.customer.update({ where: { id: customer.id }, data: { conversationState: null } })
      // deixa cair no bloco de menu abaixo
    } else {
      // Mensagem aleatória enquanto aguarda → lembra o link e mostra menu
      await reply(
        `Assim que fizer o agendamento pelo link abaixo, estará confirmado!\n${bookingUrl}\n\n` + menuReturnText(),
        "MENU"
      )
      return
    }
  }

  // ── Estado: null ou MENU — processa escolha do menu ───────────────────────

  if (input === "1") {
    await reply(
      getBookingLinkMessage({ customerName: firstName, bookingUrl, businessName: user.name }),
      "AWAITING_BOOKING"
    )
    return
  }

  if (input === "2") {
    const upcoming = await prisma.appointment.findMany({
      where: {
        customerId: customer.id,
        userId:     user.id,
        status:     { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        startTime:  { gte: new Date() },
      },
      include:  { service: true },
      orderBy:  { startTime: "asc" },
      take: 5,
    })

    if (upcoming.length === 0) {
      await reply(
        `Você não tem agendamentos ativos em *${user.name}*.\n\n` + menuReturnText(),
        "MENU"
      )
    } else {
      const list = upcoming.map(formatAppointmentLine).join("\n")
      await reply(
        `📅 Seus próximos agendamentos em *${user.name}*:\n\n${list}\n\n` + menuReturnText(),
        "MENU"
      )
    }
    return
  }

  if (input === "3") {
    const next = await prisma.appointment.findFirst({
      where: {
        customerId: customer.id,
        userId:     user.id,
        status:     { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        startTime:  { gte: new Date() },
      },
      orderBy: { startTime: "asc" },
      include: { service: true },
    })

    if (!next) {
      await reply(
        `Não há agendamentos ativos para cancelar em *${user.name}*.\n\n` + menuReturnText(),
        "MENU"
      )
      return
    }

    const dateStr = format(new Date(next.startTime), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })
    await reply(
      `Você quer cancelar este agendamento?\n\n` +
      `*${next.service.name}* — ${dateStr}\n\n` +
      `*1* — Sim, cancelar\n` +
      `*2* — Não, manter`,
      "AWAITING_CANCEL_CONFIRM"
    )
    return
  }

  // Nenhuma opção reconhecida:
  // — null → primeira interação → menu de boas-vindas
  // — MENU → cliente digitou algo inválido → pede para repetir
  if (currentState === null || input === "MENU") {
    await reply(menuText(user.name, firstName), "MENU")
  } else {
    await reply(invalidOptionText(), "MENU")
  }
}

// ── Handler POST ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // const secret = process.env.WEBHOOK_SECRET
    // if (secret) {
    //   const incoming = request.headers.get("x-webhook-secret")
    //   if (incoming !== secret) {
    //     return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    //   }
    // }

    const payload: EvolutionWebhookPayload = await request.json()

    console.log(`[Webhook] evento=${payload.event} | instance=${payload.instance}`)

    // Normaliza o nome do evento — Evolution API pode enviar em formatos diferentes:
    // "messages.upsert", "MESSAGES_UPSERT", "messages_upsert"
    const event = payload.event?.toLowerCase().replace(/_/g, ".")

    if (event === "connection.update") {
      await handleConnectionUpdate(payload)
      return NextResponse.json({ success: true })
    }

    if (event !== "messages.upsert") {
      return NextResponse.json({ success: true, message: "Evento ignorado" })
    }

    const msgData = extractMessageData(payload)
    if (!msgData) {
      return NextResponse.json({ success: true, message: "Mensagem ignorada" })
    }

    if (msgData.key.fromMe) {
      return NextResponse.json({ success: true, message: "Mensagem própria ignorada" })
    }

    // Deduplicação: ignora se já processamos esta mensagem
    // (Evolution API pode enviar o mesmo webhook mais de uma vez)
    const messageId = msgData.key.id
    if (messageId && isDuplicate(messageId)) {
      console.log(`[Webhook] Mensagem duplicada ignorada: ${messageId}`)
      return NextResponse.json({ success: true, message: "Duplicata ignorada" })
    }

    // Ignora mensagens sem texto (stickers, áudios, etc. que passaram o filtro de tipo)
    const text = extractText(msgData)
    if (!text) {
      console.log(`[Webhook] Mensagem sem texto extraível — ignorando (type=${msgData.messageType})`)
      return NextResponse.json({ success: true, message: "Sem texto" })
    }

    // Processa a mensagem de forma assíncrona para responder rápido ao webhook
    processMessage(payload.instance, msgData).catch((err) =>
      console.error("[Webhook] Erro no processamento:", err)
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
    message: "Webhook ativo",
    timestamp: new Date().toISOString(),
  })
}
