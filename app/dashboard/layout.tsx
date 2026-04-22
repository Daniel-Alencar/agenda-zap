import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
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

  if (!authUser) redirect("/login")

  // Busca o usuário no Prisma incluindo campos de assinatura
  let user = await prisma.user.findUnique({
    where:  { id: authUser.id },
    select: {
      id:                true,
      name:              true,
      email:             true,
      username:          true,
      evolutionConnected: true,
      planStatus:        true,
      trialEndsAt:       true,
      planExpiresAt:     true,
    },
  })

  // Usuário existe no Supabase mas ainda não no Prisma — recria o registro.
  if (!user) {
    const meta     = authUser.user_metadata ?? {}
    const name     = (meta.name as string) || authUser.email?.split("@")[0] || "Usuário"
    const username =
      (meta.username as string) ||
      authUser.email?.split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "") ||
      `user_${authUser.id.slice(0, 8)}`

    const safeUsername = await ensureUniqueUsername(username)

    user = await prisma.user.upsert({
      where:  { id: authUser.id },
      update: {},
      create: {
        id:          authUser.id,
        email:       authUser.email!,
        name,
        username:    safeUsername,
        password:    "",
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      select: {
        id:                true,
        name:              true,
        email:             true,
        username:          true,
        evolutionConnected: true,
        planStatus:        true,
        trialEndsAt:       true,
        planExpiresAt:     true,
      },
    })
  }

  // ── Verificação de assinatura ─────────────────────────────────────────────
  // Feito aqui no Server Component porque o middleware roda no Edge Runtime
  // e não pode importar o Prisma.
  // A página /pricing fica FORA de /dashboard, então não há loop de redirect.
  const now = new Date()
  const expired =
    user.planStatus === "EXPIRED" ||
    (user.planStatus === "TRIAL"  && new Date(user.trialEndsAt)  < now) ||
    (user.planStatus === "ACTIVE" && user.planExpiresAt !== null && new Date(user.planExpiresAt) < now)

  if (expired) {
    redirect("/pricing")
  }

  return (
    <DashboardShell
      userName={user.name}
      userEmail={user.email}
      username={user.username}
      whatsappConnected={user.evolutionConnected}
      planStatus={user.planStatus}
      trialEndsAt={user.trialEndsAt?.toISOString() ?? null}
      planExpiresAt={user.planExpiresAt?.toISOString() ?? null}
    >
      {children}
    </DashboardShell>
  )
}

async function ensureUniqueUsername(base: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { username: base } })
  if (!existing) return base

  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}_${i}`
    const conflict  = await prisma.user.findUnique({ where: { username: candidate } })
    if (!conflict) return candidate
  }
  return `${base}_${Date.now().toString(36)}`
}