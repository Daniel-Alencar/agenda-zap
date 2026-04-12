// GET  /api/notifications         — lista as últimas 30 notificações do usuário
// PATCH /api/notifications         — marca todas como lidas

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const notifications = await prisma.notification.findMany({
    where:   { userId: user.id },
    orderBy: { createdAt: "desc" },
    take:    30,
    select: {
      id:            true,
      type:          true,
      title:         true,
      body:          true,
      read:          true,
      createdAt:     true,
      appointmentId: true,
    },
  })

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, read: false },
  })

  return NextResponse.json({ notifications, unreadCount })
}

export async function PATCH() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data:  { read: true },
  })

  return NextResponse.json({ success: true })
}
