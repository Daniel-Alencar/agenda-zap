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
}

/** 
 * Normaliza o número para o formato que a Evolution API aceita:
 *  somente dígitos com DDI 55. 
 **/
function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("55") && digits.length >= 12) return digits
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`
  return digits
}

export async function sendTextMessage({
  instanceName,
  phoneNumber,
  message,
  delay = 1200,
}: SendTextOptions): Promise<{ success: boolean; messageId?: string }> {
  const normalizedPhone = normalizePhoneNumber(phoneNumber)
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
          number: normalizedPhone,
          text: message,
          delay: delay,
          linkPreview: false,
          mentionsEveryone: false
        }),
      }
    )

    if (!response.ok) {
      console.error(`[Evolution API] sendText erro: ${response.status} ${response.statusText}`)
      return { success: false }
    }

    const data = await response.json()
    return { success: true, messageId: data.key?.id }
  } catch (error) {
    console.error("[Evolution API] sendText falhou:", error)
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
      console.error(`[Evolution API] sendMedia erro: ${response.status} ${response.statusText}`)
      return { success: false }
    }

    const data = await response.json()
    return { success: true, messageId: data.key?.id }
  } catch (error) {
    console.error("[Evolution API] sendMedia falhou:", error)
    return { success: false }
  }
}

/**
 * Verifica o status de conexão de uma instância.
 *
 * A Evolution API v2 retorna:
 *   { "instance": { "instanceName": "...", "state": "open" } }
 *
 * A Evolution API v1 retorna:
 *   { "state": "open" }
 *
 * Esta função lida com os dois formatos.
 */
export async function getInstanceStatus(
  instanceName: string
): Promise<InstanceStatus | null> {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      { headers: { apikey: EVOLUTION_API_KEY } }
    )

    if (!response.ok) {
      console.error(`[Evolution API] connectionState erro: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()

    // v2: { instance: { state: "open" } }
    // v1: { state: "open" }
    const state: string | undefined =
      data?.instance?.state ?? data?.state

    if (!state) {
      console.error("[Evolution API] connectionState: campo 'state' não encontrado", JSON.stringify(data))
      return null
    }

    const normalized = state.toLowerCase()
    const validState =
      normalized === "open"       ? "open"
      : normalized === "connecting" ? "connecting"
      : "close"

    return { instanceName, state: validState }
  } catch (error) {
    console.error("[Evolution API] getInstanceStatus falhou:", error)
    return null
  }
}

/**
 * Obtém o QR Code para conectar uma instância.
 *
 * A Evolution API v2 retorna:
 *   { "base64": "data:image/png;base64,..." }  ← já inclui o prefixo data URI
 *
 * A Evolution API v1 retorna:
 *   { "base64": "iVBOR..." }  ← apenas o base64 puro
 *
 * Esta função normaliza os dois formatos e sempre retorna apenas o base64 puro.
 */
export async function getQRCode(
  instanceName: string
): Promise<{ qrcode: string } | null> {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
      { headers: { apikey: EVOLUTION_API_KEY } }
    )

    if (!response.ok) {
      console.error(`[Evolution API] getQRCode erro: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()

    // Pode vir como "data:image/png;base64,XXXXX" ou apenas "XXXXX"
    const raw: string | undefined = data?.base64 ?? data?.qrcode
    if (!raw) {
      console.error("[Evolution API] getQRCode: campo base64/qrcode não encontrado", JSON.stringify(data))
      return null
    }

    // Remove o prefixo data URI se presente — o componente adiciona ele mesmo
    const pureBase64 = raw.startsWith("data:")
      ? raw.split(",")[1]
      : raw

    return { qrcode: raw }
  } catch (error) {
    console.error("[Evolution API] getQRCode falhou:", error)
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

    if (!response.ok) {
      // 409 = instância já existe — não é erro fatal
      if (response.status === 409) {
        return { success: true, instanceName }
      }
      console.error(`[Evolution API] createInstance erro: ${response.status} ${response.statusText}`)
      return { success: false }
    }

    const data = await response.json()
    return { success: true, instanceName: data.instance?.instanceName ?? instanceName }
  } catch (error) {
    console.error("[Evolution API] createInstance falhou:", error)
    return { success: false }
  }
}

// ── Templates de mensagens ────────────────────────────────────────────────────

export function getBookingConfirmationMessage(data: {
  customerName: string
  serviceName: string
  date: string
  time: string
  businessName: string
}): string {
  return `Olá ${data.customerName}!

Seu agendamento foi confirmado:

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
  return `Olá ${data.customerName}!

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

Se quiser remarcar, acesse:
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
  return `Olá ${data.customerName}!

Para agendar seu horário em *${data.businessName}*, acesse o link abaixo:

${data.bookingUrl}

Escolha o serviço, data e horário que preferir!`
}
