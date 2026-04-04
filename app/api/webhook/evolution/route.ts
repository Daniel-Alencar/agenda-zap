// =============================================
// WEBHOOK DA EVOLUTION API
// =============================================
// Esta rota recebe webhooks da Evolution API quando um cliente
// envia uma mensagem no WhatsApp.
//
// CONFIGURAÇÃO NO EVOLUTION API:
// 1. Acesse o painel da Evolution API
// 2. Vá em Settings > Webhooks
// 3. Configure a URL: https://seu-dominio.com/api/webhook/evolution
// 4. Selecione os eventos: messages.upsert
//
// FLUXO:
// 1. Cliente envia mensagem no WhatsApp
// 2. Evolution API envia POST para este webhook
// 3. Processamos a mensagem e respondemos

import { NextRequest, NextResponse } from "next/server"

// =============================================
// TIPOS DO WEBHOOK DA EVOLUTION API
// =============================================
// Estrutura básica do payload da Evolution API
// Consulte a documentação oficial para mais detalhes

interface EvolutionWebhookPayload {
  event: string
  instance: string
  data: {
    key: {
      remoteJid: string // Número do WhatsApp (formato: 5511999999999@s.whatsapp.net)
      fromMe: boolean   // Se a mensagem foi enviada por nós
      id: string        // ID único da mensagem
    }
    pushName: string    // Nome do contato no WhatsApp
    message: {
      conversation?: string           // Mensagem de texto simples
      extendedTextMessage?: {
        text: string                  // Texto em mensagens com preview
      }
    }
    messageType: string
    messageTimestamp: number
  }
}

// =============================================
// HANDLER DO WEBHOOK - POST
// =============================================
export async function POST(request: NextRequest) {
  try {
    // 1. Parse do payload recebido
    const payload: EvolutionWebhookPayload = await request.json()
    
    console.log("[v0] Evolution Webhook received:", JSON.stringify(payload, null, 2))

    // 2. Validação básica do evento
    // A Evolution API envia vários tipos de eventos, filtramos apenas mensagens
    if (payload.event !== "messages.upsert") {
      return NextResponse.json({ 
        success: true, 
        message: "Evento ignorado" 
      })
    }

    // 3. Ignora mensagens enviadas por nós mesmos
    if (payload.data.key.fromMe) {
      return NextResponse.json({ 
        success: true, 
        message: "Mensagem própria ignorada" 
      })
    }

    // 4. Extrai informações da mensagem
    const senderNumber = payload.data.key.remoteJid.replace("@s.whatsapp.net", "")
    const senderName = payload.data.pushName || "Cliente"
    const messageText = 
      payload.data.message.conversation || 
      payload.data.message.extendedTextMessage?.text || 
      ""
    const instanceName = payload.instance

    console.log(`[v0] Mensagem de ${senderName} (${senderNumber}): ${messageText}`)

    // =============================================
    // LÓGICA DE PROCESSAMENTO DA MENSAGEM
    // =============================================
    // Aqui você implementa a lógica para responder ao cliente
    // com base no conteúdo da mensagem.

    // Exemplo: Detecta palavras-chave para responder com link de agendamento
    const lowerMessage = messageText.toLowerCase()
    
    // Palavras-chave que indicam interesse em agendar
    const bookingKeywords = [
      "agendar",
      "agenda",
      "horário",
      "horario",
      "marcar",
      "disponível",
      "disponivel",
      "atendimento",
      "reservar",
    ]

    const wantsToBook = bookingKeywords.some((keyword) => 
      lowerMessage.includes(keyword)
    )

    if (wantsToBook) {
      // AQUI: Buscar o lojista pelo instanceName no banco de dados
      // const user = await prisma.user.findFirst({ 
      //   where: { evolutionInstanceName: instanceName } 
      // })
      
      // AQUI: Montar a mensagem de resposta com o link de agendamento
      // const bookingUrl = `https://seu-dominio.com/${user.username}/book`
      // const responseMessage = `Olá ${senderName}! 👋\n\nPara agendar seu horário, acesse:\n${bookingUrl}`

      // AQUI: Enviar resposta via Evolution API
      // await sendWhatsAppMessage(instanceName, senderNumber, responseMessage)

      console.log(`[v0] Cliente ${senderName} quer agendar - enviar link de agendamento`)
    }

    // Palavras-chave para consultar agendamentos existentes
    const statusKeywords = ["meu agendamento", "confirmar", "cancelar", "remarcar"]
    const wantsStatus = statusKeywords.some((keyword) => 
      lowerMessage.includes(keyword)
    )

    if (wantsStatus) {
      // AQUI: Buscar agendamentos do cliente pelo número de telefone
      // const appointments = await prisma.appointment.findMany({
      //   where: { 
      //     customer: { phone: senderNumber },
      //     status: { in: ['PENDING', 'CONFIRMED'] }
      //   },
      //   include: { service: true }
      // })

      console.log(`[v0] Cliente ${senderName} quer status do agendamento`)
    }

    // =============================================
    // RESPOSTA DE SUCESSO
    // =============================================
    return NextResponse.json({
      success: true,
      message: "Webhook processado com sucesso",
      data: {
        sender: senderNumber,
        name: senderName,
        text: messageText,
        instance: instanceName,
      },
    })

  } catch (error) {
    console.error("[v0] Erro no webhook:", error)
    
    return NextResponse.json(
      { success: false, error: "Erro ao processar webhook" },
      { status: 500 }
    )
  }
}

// =============================================
// HANDLER DO WEBHOOK - GET
// =============================================
// Útil para verificar se o endpoint está funcionando
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Webhook da Evolution API está ativo",
    timestamp: new Date().toISOString(),
  })
}

// =============================================
// FUNÇÃO AUXILIAR: ENVIAR MENSAGEM VIA EVOLUTION API
// =============================================
// Descomente e configure quando integrar com a Evolution API
/*
async function sendWhatsAppMessage(
  instanceName: string,
  phoneNumber: string,
  message: string
) {
  const evolutionApiUrl = process.env.EVOLUTION_API_URL
  const evolutionApiKey = process.env.EVOLUTION_API_KEY

  const response = await fetch(
    `${evolutionApiUrl}/message/sendText/${instanceName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionApiKey!,
      },
      body: JSON.stringify({
        number: phoneNumber,
        options: {
          delay: 1200, // Delay para parecer mais humano
          presence: "composing", // Mostra "digitando..."
        },
        textMessage: {
          text: message,
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Falha ao enviar mensagem: ${response.statusText}`)
  }

  return response.json()
}
*/
