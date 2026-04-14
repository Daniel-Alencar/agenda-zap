// POST /api/payment/create-preference
// Cria uma preferência de pagamento no Mercado Pago e retorna o init_point.
// Chamada pelo register-form após criar a conta, quando o usuário escolheu plano pago.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { createPaymentPreference } from "@/lib/mercadopago"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

    const body     = await request.json()
    const planType = body.planType as string

    if (planType !== "MONTHLY" && planType !== "ANNUAL") {
      return NextResponse.json({ error: "planType inválido." }, { status: 400 })
    }

    const dbUser = await prisma.user.findUnique({
      where:  { id: user.id },
      select: { id: true, email: true, planStatus: true },
    })
    if (!dbUser) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })

    // Salva o plano pendente no banco para o webhook poder ativá-lo
    await prisma.user.update({
      where: { id: user.id },
      data:  { pendingPlanType: planType as "MONTHLY" | "ANNUAL" },
    })

    // Cria a preferência no Mercado Pago
    const preference = await createPaymentPreference({
      userId:    user.id,
      planType:  planType as "MONTHLY" | "ANNUAL",
      userEmail: dbUser.email,
    })

    // Sandbox usa sandbox_init_point, produção usa init_point
    const checkoutUrl =
      process.env.NODE_ENV === "production"
        ? preference.init_point
        : preference.sandbox_init_point

    if (!checkoutUrl) {
      return NextResponse.json({ error: "Erro ao gerar link de pagamento." }, { status: 500 })
    }

    return NextResponse.json({ checkoutUrl, preferenceId: preference.id })
  } catch (err) {
    console.error("[Payment] create-preference erro:", err)
    return NextResponse.json({ error: "Erro interno ao processar pagamento." }, { status: 500 })
  }
}
