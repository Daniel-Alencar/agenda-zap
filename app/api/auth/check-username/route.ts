// =============================================
// API: VERIFICAR DISPONIBILIDADE DE USERNAME
// =============================================

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")

  if (!username || username.length < 3) {
    return NextResponse.json({ available: false, error: "Username inválido" })
  }

  // Valida o formato do username
  const usernameRegex = /^[a-z0-9_-]{3,30}$/
  if (!usernameRegex.test(username)) {
    return NextResponse.json({ available: false, error: "Formato inválido" })
  }

  // Palavras reservadas que não podem ser usadas como username
  const reservedWords = [
    "admin",
    "api",
    "dashboard",
    "login",
    "register",
    "app",
    "auth",
    "www",
    "mail",
    "support",
    "help",
    "about",
    "pricing",
    "blog",
  ]

  if (reservedWords.includes(username.toLowerCase())) {
    return NextResponse.json({
      available: false,
      error: "Username reservado",
    })
  }

  const existing = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true },
  })

  return NextResponse.json({ available: !existing })
}
