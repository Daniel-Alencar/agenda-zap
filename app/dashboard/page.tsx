// =============================================
// PÁGINA PRINCIPAL DO DASHBOARD — dados reais
// =============================================
// Server Component: busca sessão, métricas e agendamentos do banco
// e distribui para os componentes filhos.

import { redirect } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { MessageCircle } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { getTodayAppointments, getDashboardStats } from "@/lib/data/dashboard"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { AppointmentsTable } from "@/components/dashboard/appointments-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function DashboardPage() {
  // Autenticação
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Busca dados em paralelo
  const [appointments, stats] = await Promise.all([
    getTodayAppointments(user.id),
    getDashboardStats(user.id),
  ])

  const todayLabel = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
  // Capitaliza primeira letra
  const todayFormatted = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Bem-vindo de volta! Aqui está o resumo de hoje.
          </p>
        </div>
        <Link href="/dashboard/whatsapp">
          <Button className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Conectar WhatsApp
          </Button>
        </Link>
      </div>

      {/* Métricas */}
      <StatsCards stats={stats} />

      {/* Tabela de agendamentos do dia */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Agendamentos de Hoje</CardTitle>
              <CardDescription>{todayFormatted}</CardDescription>
            </div>
            <Link href="/dashboard/appointments">
              <Button variant="outline" size="sm">
                Ver todos
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <AppointmentsTable appointments={appointments} />
        </CardContent>
      </Card>
    </div>
  )
}
