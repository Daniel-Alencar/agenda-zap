// POST /api/payment/webhook
// Recebe notificações do Mercado Pago e ativa o plano quando o pagamento é aprovado.
//
// O MP envia dois tipos de notificação:
//   type=payment  → pagamento individual (o que nos interessa)
//   type=plan/subscription → assinaturas recorrentes (não usado aqui)
//
// Validação de assinatura: o MP envia o header x-signature com HMAC SHA256.
// Configure MP_WEBHOOK_SECRET no painel do MP → Webhooks.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { mpClient, PLAN_CONFIG } from "@/lib/mercadopago"
import { Payment } from "mercadopago"
import crypto from "crypto"

function verifySignature(request: NextRequest, rawBody: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) return true // sem secret configurado, aceita tudo (apenas para dev)

  const signature = request.headers.get("x-signature") ?? ""
  const requestId = request.headers.get("x-request-id") ?? ""
  const dataId    = new URL(request.url).searchParams.get("data.id") ?? ""

  // Formato MP: ts=<timestamp>,v1=<hmac>
  const parts: Record<string, string> = {}
  signature.split(",").forEach((part) => {
    const [k, v] = part.split("=")
    if (k && v) parts[k] = v
  })

  if (!parts.ts || !parts.v1) return false

  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex")

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1))
}

export async function POST(request: NextRequest) {
  let rawBody = ""
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 })
  }

  // Verifica assinatura do webhook
  if (!verifySignature(request, rawBody)) {
    console.warn("[Payment/Webhook] Assinatura inválida")
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 })
  }

  let body: { type?: string; data?: { id?: string } }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 })
  }

  console.log(`[Payment/Webhook] type=${body.type} data.id=${body.data?.id}`)

  // Só processa eventos de pagamento
  if (body.type !== "payment" || !body.data?.id) {
    return NextResponse.json({ received: true })
  }

  try {
    // Busca os detalhes do pagamento na API do MP
    const paymentApi = new Payment(mpClient)
    const payment    = await paymentApi.get({ id: body.data.id })

    console.log(`[Payment/Webhook] status=${payment.status} external_ref=${payment.external_reference}`)

    if (payment.status !== "approved") {
      // Pagamento pendente, recusado, etc. — não faz nada por ora
      return NextResponse.json({ received: true })
    }

    const userId = payment.external_reference
    if (!userId) {
      console.error("[Payment/Webhook] external_reference ausente")
      return NextResponse.json({ error: "external_reference ausente." }, { status: 400 })
    }

    // Busca o usuário e o plano pendente
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, pendingPlanType: true, planStatus: true },
    })

    if (!user) {
      console.error(`[Payment/Webhook] Usuário não encontrado: ${userId}`)
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })
    }

    const planType = user.pendingPlanType
    if (!planType) {
      // Pode já ter sido processado (webhook duplicado)
      console.warn(`[Payment/Webhook] Sem pendingPlanType para userId=${userId} — já processado?`)
      return NextResponse.json({ received: true })
    }

    // Calcula data de expiração do plano
    const now     = new Date()
    const months  = PLAN_CONFIG[planType].months
    const expires = new Date(now)
    expires.setMonth(expires.getMonth() + months)

    // Ativa o plano
    await prisma.user.update({
      where: { id: userId },
      data:  {
        planStatus:      "ACTIVE",
        planType,
        planExpiresAt:   expires,
        pendingPlanType: null, // limpa o campo pendente
      },
    })

    console.log(`[Payment/Webhook] Plano ${planType} ativado para ${userId} até ${expires.toISOString()}`)

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("[Payment/Webhook] Erro ao processar pagamento:", err)
    // Retorna 200 para o MP não retentar — o erro é apenas de processamento interno
    return NextResponse.json({ received: true })
  }
}
