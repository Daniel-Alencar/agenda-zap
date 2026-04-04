// =============================================
// CLIENTE EVOLUTION API
// =============================================
// Funções utilitárias para integração com a Evolution API.
// Documentação: https://doc.evolution-api.com/

// Configuração via variáveis de ambiente
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080"
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ""

// =============================================
// TIPOS
// =============================================

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

// =============================================
// FUNÇÕES DE ENVIO DE MENSAGENS
// =============================================

/**
 * Envia uma mensagem de texto via WhatsApp
 */
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
          options: {
            delay,
            presence: "composing",
          },
          textMessage: {
            text: message,
          },
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

/**
 * Envia uma mensagem com mídia (imagem, vídeo, áudio ou documento)
 */
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
          options: {
            delay: 1200,
            presence: "composing",
          },
          mediaMessage: {
            mediatype: mediaType,
            media: mediaUrl,
            caption,
          },
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

// =============================================
// FUNÇÕES DE GERENCIAMENTO DE INSTÂNCIA
// =============================================

/**
 * Verifica o status de conexão de uma instância
 */
export async function getInstanceStatus(
  instanceName: string
): Promise<InstanceStatus | null> {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      {
        headers: {
          apikey: EVOLUTION_API_KEY,
        },
      }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return {
      instanceName,
      state: data.state,
    }
  } catch (error) {
    console.error("[Evolution API] Erro ao verificar status:", error)
    return null
  }
}

/**
 * Obtém o QR Code para conectar uma instância
 */
export async function getQRCode(
  instanceName: string
): Promise<{ qrcode: string } | null> {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
      {
        headers: {
          apikey: EVOLUTION_API_KEY,
        },
      }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return { qrcode: data.base64 }
  } catch (error) {
    console.error("[Evolution API] Erro ao obter QR Code:", error)
    return null
  }
}

/**
 * Cria uma nova instância
 */
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
      return { success: false }
    }

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

/**
 * Gera mensagem de confirmação de agendamento
 */
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

/**
 * Gera mensagem de lembrete de agendamento
 */
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

/**
 * Gera mensagem com link de agendamento
 */
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
