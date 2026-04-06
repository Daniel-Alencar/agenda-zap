// GET /api/whatsapp/status
// Retorna o status atual da instância Evolution para o lojista autenticado.
// Chamado pelo cliente a cada 5 segundos enquanto o QR está visível.

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { getInstanceStatus } from "@/lib/evolution"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      evolutionInstanceName: true,
      evolutionConnected: true,
    },
  })

  if (!dbUser) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })

  // Se não tem instanceName, retorna estado inicial
  if (!dbUser.evolutionInstanceName) {
    return NextResponse.json({
      state: "not_configured",
      connected: false,
      instanceName: null,
    })
  }

  // Consulta o estado em tempo real na Evolution API
  const status = await getInstanceStatus(dbUser.evolutionInstanceName)

  // Sincroniza o banco se o estado mudou
  const isNowConnected = status?.state === "open"
  if (isNowConnected !== dbUser.evolutionConnected) {
    await prisma.user.update({
      where: { id: user.id },
      data: { evolutionConnected: isNowConnected },
    })
  }

  return NextResponse.json({
    state: status?.state ?? "close",
    connected: isNowConnected,
    instanceName: dbUser.evolutionInstanceName,
  })
}
