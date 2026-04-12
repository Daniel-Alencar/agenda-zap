// PATCH /api/notifications/[id] — marca uma notificação específica como lida

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { id } = await params

  // Verifica ownership antes de atualizar
  const notification = await prisma.notification.findFirst({
    where: { id, userId: user.id },
  })
  if (!notification) {
    return NextResponse.json({ error: "Notificação não encontrada." }, { status: 404 })
  }

  await prisma.notification.update({
    where: { id },
    data:  { read: true },
  })

  return NextResponse.json({ success: true })
}
