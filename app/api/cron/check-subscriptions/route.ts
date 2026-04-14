// GET /api/cron/check-subscriptions
// Roda uma vez por dia. Verifica trials e planos expirados:
// - Marca usuários como EXPIRED
// - Desconecta a instância WhatsApp deles

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL ?? "http://localhost:8080"
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY ?? ""

async function logoutInstance(instanceName: string) {
  try {
    await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
      method:  "DELETE",
      headers: { apikey: EVOLUTION_API_KEY },
    })
  } catch (err) {
    console.error(`[Cron/Subscriptions] Falha ao desconectar instância ${instanceName}:`, err)
  }
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const now = new Date()

  // Busca usuários que deveriam ser expirados e ainda não foram
  const toExpire = await prisma.user.findMany({
    where: {
      planStatus: { not: "EXPIRED" },
      OR: [
        // Trial vencido
        { planStatus: "TRIAL",  trialEndsAt:   { lt: now } },
        // Plano pago vencido
        { planStatus: "ACTIVE", planExpiresAt: { lt: now } },
      ],
    },
    select: {
      id:                   true,
      email:                true,
      evolutionInstanceName: true,
      evolutionConnected:   true,
    },
  })

  console.log(`[Cron/Subscriptions] ${toExpire.length} conta(s) a expirar`)

  let expired = 0
  let disconnected = 0

  for (const user of toExpire) {
    // Desconecta o WhatsApp se estiver conectado
    if (user.evolutionConnected && user.evolutionInstanceName) {
      await logoutInstance(user.evolutionInstanceName)
      disconnected++
    }

    // Marca como expirado
    await prisma.user.update({
      where: { id: user.id },
      data:  {
        planStatus:        "EXPIRED",
        evolutionConnected: false,
      },
    })

    console.log(`[Cron/Subscriptions] Expirado: ${user.email}`)
    expired++
  }

  return NextResponse.json({ expired, disconnected })
}
