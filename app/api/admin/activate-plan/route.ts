// POST /api/admin/activate-plan
// Ativa o plano pago de um usuário após confirmação do pagamento.
// Protegida por ADMIN_SECRET — chamada manualmente ou por webhook do gateway.
//
// Body: { email: string, planType: "MONTHLY" | "ANNUAL" }

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) {
    return NextResponse.json({ error: "ADMIN_SECRET não configurado." }, { status: 500 })
  }

  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { email, planType } = body as { email?: string; planType?: string }

  if (!email || !planType) {
    return NextResponse.json({ error: "email e planType são obrigatórios." }, { status: 400 })
  }
  if (planType !== "MONTHLY" && planType !== "ANNUAL") {
    return NextResponse.json({ error: "planType deve ser MONTHLY ou ANNUAL." }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, planStatus: true },
  })

  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })
  }

  const now     = new Date()
  const months  = planType === "MONTHLY" ? 1 : 12
  const expires = new Date(now)
  expires.setMonth(expires.getMonth() + months)

  await prisma.user.update({
    where: { id: user.id },
    data:  {
      planStatus:    "ACTIVE",
      planType:      planType,
      planExpiresAt: expires,
    },
  })

  console.log(`[Admin] Plano ${planType} ativado para ${email} até ${expires.toISOString()}`)

  return NextResponse.json({
    success:      true,
    email,
    planType,
    planExpiresAt: expires.toISOString(),
  })
}
