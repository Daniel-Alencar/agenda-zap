import { redirect } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect("/login")
  }

  // Busca o usuário no Prisma
  let user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, name: true, email: true, username: true, evolutionConnected: true },
  })

  // Usuário existe no Supabase mas ainda não no Prisma.
  // Isso acontece quando o cadastro foi feito mas o create no Prisma falhou,
  // ou quando o e-mail foi confirmado e a sessão foi criada antes do registro existir.
  // Solução: recriar o registro a partir dos metadados do Supabase.
  if (!user) {
    const meta = authUser.user_metadata ?? {}
    const name = (meta.name as string) || authUser.email?.split("@")[0] || "Usuário"
    const username =
      (meta.username as string) ||
      authUser.email?.split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "") ||
      `user_${authUser.id.slice(0, 8)}`

    // Garante que o username não colide com outro já existente
    const safeUsername = await ensureUniqueUsername(username)

    user = await prisma.user.upsert({
      where: { id: authUser.id },
      update: {},
      create: {
        id: authUser.id,
        email: authUser.email!,
        name,
        username: safeUsername,
        password: "",
      },
      select: { id: true, name: true, email: true, username: true, evolutionConnected: true },
    })
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar whatsappConnected={user.evolutionConnected} />
      <div className="flex flex-1 flex-col">
        <DashboardHeader
          userName={user.name}
          userEmail={user.email}
          username={user.username}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}

// Garante username único acrescentando sufixo numérico se necessário
async function ensureUniqueUsername(base: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { username: base } })
  if (!existing) return base

  // Tenta base_2, base_3, ...
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}_${i}`
    const conflict = await prisma.user.findUnique({ where: { username: candidate } })
    if (!conflict) return candidate
  }
  // Fallback com parte do UUID
  return `${base}_${Date.now().toString(36)}`
}
