// GET /api/whatsapp/qrcode
// Busca um QR Code fresco da Evolution API para a instância do lojista.
// O QR expira a cada ~30 segundos — o cliente chama esta rota para renovar.

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { getQRCode, getInstanceStatus } from "@/lib/evolution"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { evolutionInstanceName: true, evolutionConnected: true },
  })

  if (!dbUser?.evolutionInstanceName) {
    return NextResponse.json({ error: "Instância não configurada." }, { status: 400 })
  }

  // Se já está conectado, não precisa de QR
  const status = await getInstanceStatus(dbUser.evolutionInstanceName)
  if (status?.state === "open") {
    return NextResponse.json({ connected: true })
  }

  const qr = await getQRCode(dbUser.evolutionInstanceName)

  if (!qr?.qrcode) {
    return NextResponse.json({ error: "QR Code indisponível. Tente novamente." }, { status: 503 })
  }

  return NextResponse.json({ qrcode: qr.qrcode, connected: false })
}
