// =============================================
// LAYOUT DO DASHBOARD (com autenticação real)
// =============================================

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

  // Verifica sessão (o middleware já redireciona, mas é boa prática verificar aqui também)
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect("/login")
  }

  // Busca dados completos do usuário no banco
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      evolutionConnected: true,
    },
  })

  if (!user) {
    redirect("/login")
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
