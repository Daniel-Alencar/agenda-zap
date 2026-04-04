// =============================================
// CARDS DE MÉTRICAS DO DASHBOARD
// =============================================
// Recebe dados reais do Server Component pai — sem fetch próprio.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Users, DollarSign, TrendingUp } from "lucide-react"

interface StatsCardsProps {
  stats: {
    today: { count: number; vsYesterday: number }
    customers: { total: number; newThisMonth: number }
    revenue: { thisMonth: number; growth: number | null }
    confirmationRate: number | null
  }
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDiff(n: number) {
  if (n > 0) return `+${n} em relação a ontem`
  if (n < 0) return `${n} em relação a ontem`
  return "Igual a ontem"
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: "Agendamentos Hoje",
      value: String(stats.today.count),
      description: formatDiff(stats.today.vsYesterday),
      icon: Calendar,
    },
    {
      title: "Clientes Ativos",
      value: String(stats.customers.total),
      description:
        stats.customers.newThisMonth > 0
          ? `+${stats.customers.newThisMonth} este mês`
          : "Nenhum novo este mês",
      icon: Users,
    },
    {
      title: "Receita do Mês",
      value: formatCurrency(stats.revenue.thisMonth),
      description:
        stats.revenue.growth !== null
          ? `${stats.revenue.growth >= 0 ? "+" : ""}${stats.revenue.growth}% vs mês passado`
          : "Primeiro mês",
      icon: DollarSign,
    },
    {
      title: "Taxa de Confirmação",
      value:
        stats.confirmationRate !== null ? `${stats.confirmationRate}%` : "—",
      description: "Últimos 30 dias",
      icon: TrendingUp,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
