// =============================================
// PÁGINA PRINCIPAL DO DASHBOARD
// =============================================
// Exibe os agendamentos do dia e métricas importantes.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Calendar, 
  Users, 
  DollarSign, 
  TrendingUp,
  MessageCircle,
  Clock,
  Phone,
  MoreVertical
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Dados de exemplo para demonstração
// Em produção, esses dados viriam do banco de dados via Prisma
const todayAppointments = [
  {
    id: "1",
    time: "09:00",
    customer: "Maria Santos",
    phone: "(11) 99999-1234",
    service: "Corte de Cabelo",
    duration: "45 min",
    price: "R$ 50,00",
    status: "CONFIRMED" as const,
  },
  {
    id: "2",
    time: "10:00",
    customer: "Pedro Oliveira",
    phone: "(11) 99999-5678",
    service: "Barba",
    duration: "30 min",
    price: "R$ 35,00",
    status: "PENDING" as const,
  },
  {
    id: "3",
    time: "11:00",
    customer: "Ana Costa",
    phone: "(11) 99999-9012",
    service: "Corte + Barba",
    duration: "60 min",
    price: "R$ 75,00",
    status: "CONFIRMED" as const,
  },
  {
    id: "4",
    time: "14:00",
    customer: "Carlos Mendes",
    phone: "(11) 99999-3456",
    service: "Corte de Cabelo",
    duration: "45 min",
    price: "R$ 50,00",
    status: "PENDING" as const,
  },
  {
    id: "5",
    time: "15:30",
    customer: "Lucia Ferreira",
    phone: "(11) 99999-7890",
    service: "Manicure",
    duration: "40 min",
    price: "R$ 40,00",
    status: "CANCELLED" as const,
  },
]

const stats = [
  {
    title: "Agendamentos Hoje",
    value: "5",
    description: "+2 em relação a ontem",
    icon: Calendar,
    trend: "up",
  },
  {
    title: "Clientes Ativos",
    value: "128",
    description: "+12 este mês",
    icon: Users,
    trend: "up",
  },
  {
    title: "Receita do Mês",
    value: "R$ 4.850",
    description: "+18% vs mês passado",
    icon: DollarSign,
    trend: "up",
  },
  {
    title: "Taxa de Confirmação",
    value: "92%",
    description: "Últimos 30 dias",
    icon: TrendingUp,
    trend: "up",
  },
]

const statusConfig = {
  CONFIRMED: { label: "Confirmado", variant: "default" as const },
  PENDING: { label: "Pendente", variant: "secondary" as const },
  CANCELLED: { label: "Cancelado", variant: "destructive" as const },
  COMPLETED: { label: "Concluído", variant: "outline" as const },
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header da Página */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Bem-vindo de volta! Aqui está o resumo de hoje.
          </p>
        </div>
        
        {/* Botão Conectar WhatsApp */}
        <Button className="gap-2">
          <MessageCircle className="h-4 w-4" />
          Conectar WhatsApp
        </Button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela de Agendamentos do Dia */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Agendamentos de Hoje</CardTitle>
              <CardDescription>
                {new Date().toLocaleDateString("pt-BR", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              Ver todos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Horário</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Serviço</TableHead>
                <TableHead className="hidden lg:table-cell">Duração</TableHead>
                <TableHead className="hidden sm:table-cell">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todayAppointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{appointment.time}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{appointment.customer}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {appointment.phone}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {appointment.service}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {appointment.duration}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell font-medium">
                    {appointment.price}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[appointment.status].variant}>
                      {statusConfig[appointment.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Ações</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Confirmar</DropdownMenuItem>
                        <DropdownMenuItem>Enviar Lembrete</DropdownMenuItem>
                        <DropdownMenuItem>Remarcar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          Cancelar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
