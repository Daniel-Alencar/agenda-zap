// =============================================
// CLIENTE EVOLUTION API
// =============================================

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080"
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ""

interface SendTextOptions {
  instanceName: string
  phoneNumber: string
  message: string
  delay?: number
}

interface SendMediaOptions {
  instanceName: string
  phoneNumber: string
  mediaType: "image" | "video" | "audio" | "document"
  mediaUrl: string
  caption?: string
}

interface InstanceStatus {
  instanceName: string
  state: "open" | "close" | "connecting"
  qrcode?: string
}

export async function sendTextMessage({
  instanceName,
  phoneNumber,
  message,
  delay = 1200,
}: SendTextOptions): Promise<{ success: boolean; messageId?: string }> {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: phoneNumber,
          options: { delay, presence: "composing" },
          textMessage: { text: message },
        }),
      }
    )

    if (!response.ok) {
      console.error(`[Evolution API] Erro: ${response.statusText}`)
      return { success: false }
    }

    const data = await response.json()
    return { success: true, messageId: data.key?.id }
  } catch (error) {
    console.error("[Evolution API] Erro ao enviar mensagem:", error)
    return { success: false }
  }
}

export async function sendMediaMessage({
  instanceName,
  phoneNumber,
  mediaType,
  mediaUrl,
  caption,
}: SendMediaOptions): Promise<{ success: boolean; messageId?: string }> {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: phoneNumber,
          options: { delay: 1200, presence: "composing" },
          mediaMessage: { mediatype: mediaType, media: mediaUrl, caption },
        }),
      }
    )

    if (!response.ok) {
      console.error(`[Evolution API] Erro: ${response.statusText}`)
      return { success: false }
    }

    const data = await response.json()
    return { success: true, messageId: data.key?.id }
  } catch (error) {
    console.error("[Evolution API] Erro ao enviar mídia:", error)
    return { success: false }
  }
}

export async function getInstanceStatus(
  instanceName: string
): Promise<InstanceStatus | null> {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      { headers: { apikey: EVOLUTION_API_KEY } }
    )
    if (!response.ok) return null
    const data = await response.json()
    return { instanceName, state: data.state }
  } catch (error) {
    console.error("[Evolution API] Erro ao verificar status:", error)
    return null
  }
}

export async function getQRCode(
  instanceName: string
): Promise<{ qrcode: string } | null> {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
      { headers: { apikey: EVOLUTION_API_KEY } }
    )
    if (!response.ok) return null
    const data = await response.json()
    return { qrcode: data.base64 }
  } catch (error) {
    console.error("[Evolution API] Erro ao obter QR Code:", error)
    return null
  }
}

export async function createInstance(
  instanceName: string
): Promise<{ success: boolean; instanceName?: string }> {
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    })
    if (!response.ok) return { success: false }
    const data = await response.json()
    return { success: true, instanceName: data.instance?.instanceName }
  } catch (error) {
    console.error("[Evolution API] Erro ao criar instância:", error)
    return { success: false }
  }
}

// =============================================
// TEMPLATES DE MENSAGENS
// =============================================

export function getBookingConfirmationMessage(data: {
  customerName: string
  serviceName: string
  date: string
  time: string
  businessName: string
}): string {
  return `Olá ${data.customerName}! 👋

Seu agendamento foi *confirmado*:

*Serviço:* ${data.serviceName}
*Data:* ${data.date}
*Horário:* ${data.time}

Aguardamos você em *${data.businessName}*!

Qualquer dúvida, é só responder esta mensagem.`
}

export function getBookingReminderMessage(data: {
  customerName: string
  serviceName: string
  time: string
  businessName: string
}): string {
  return `Olá ${data.customerName}! 👋

Lembrete: você tem um agendamento *hoje* às *${data.time}*.

*Serviço:* ${data.serviceName}

Aguardamos você em *${data.businessName}*!

Caso precise remarcar, responda esta mensagem.`
}

export function getBookingCancellationMessage(data: {
  customerName: string
  serviceName: string
  date: string
  time: string
  businessName: string
  bookingUrl: string
}): string {
  return `Olá ${data.customerName}!

Seu agendamento foi *cancelado*:

*Serviço:* ${data.serviceName}
*Data:* ${data.date}
*Horário:* ${data.time}

Sentimos muito! Se quiser remarcar, acesse:
${data.bookingUrl}

Qualquer dúvida estamos à disposição em *${data.businessName}*.`
}

export function getBookingRescheduleMessage(data: {
  customerName: string
  serviceName: string
  oldDate: string
  oldTime: string
  newDate: string
  newTime: string
  businessName: string
}): string {
  return `Olá ${data.customerName}! 👋

Seu agendamento foi *remarcado*:

*Serviço:* ${data.serviceName}

~~${data.oldDate} às ${data.oldTime}~~
✅ *${data.newDate} às ${data.newTime}*

Aguardamos você em *${data.businessName}*!

Qualquer dúvida, é só responder esta mensagem.`
}

export function getBookingLinkMessage(data: {
  customerName: string
  bookingUrl: string
  businessName: string
}): string {
  return `Olá ${data.customerName}! 👋

Para agendar seu horário em *${data.businessName}*, acesse o link abaixo:

${data.bookingUrl}

Escolha o serviço, data e horário que preferir!`
}
