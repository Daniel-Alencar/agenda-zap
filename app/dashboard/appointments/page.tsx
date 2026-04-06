import { redirect } from "next/navigation"
import { Suspense } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarDays } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import {
  getAppointments,
  getAppointmentCounts,
  APPOINTMENTS_PER_PAGE,
  type StatusFilter,
  type PeriodFilter,
} from "@/lib/data/appointments"
import { AppointmentsTable } from "@/components/dashboard/appointments-table"
import { AppointmentFilters } from "@/components/dashboard/appointments/appointment-filters"
import { AppointmentsPagination } from "@/components/dashboard/appointments/appointments-pagination"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = { title: "Agendamentos — AgendaZap" }

interface AppointmentsPageProps {
  searchParams: Promise<{
    search?: string
    status?: string
    period?: string
    date?: string
    page?: string
  }>
}

const VALID_STATUSES = ["all", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]
const VALID_PERIODS  = ["all", "today", "week", "month", "upcoming", "custom"]

export default async function AppointmentsPage({ searchParams }: AppointmentsPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const sp = await searchParams

  const search = (sp.search ?? "").trim()
  const status = (VALID_STATUSES.includes(sp.status ?? "")
    ? sp.status ?? "all"
    : "all") as StatusFilter
  const period = (VALID_PERIODS.includes(sp.period ?? "")
    ? sp.period ?? "upcoming"
    : "upcoming") as PeriodFilter
  const date   = sp.date ?? ""
  const page   = Math.max(1, Number(sp.page) || 1)

  // Busca username do lojista para o dialog de reagendamento
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { username: true },
  })
  const username = dbUser?.username ?? ""

  const [{ appointments, total, totalPages }, counts] = await Promise.all([
    getAppointments(user.id, { search, status, period, date, page }),
    getAppointmentCounts(user.id),
  ])

  // Injeta username em cada appointment (necessário para o dialog de reagendamento)
  const appointmentsWithUsername = appointments.map((a) => ({ ...a, username }))

  // Título dinâmico conforme o filtro de período
  function periodLabel() {
    if (period === "today") return format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })
    if (period === "week")     return "Esta semana"
    if (period === "month")    return format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })
    if (period === "upcoming") return "Próximos agendamentos"
    if (period === "custom" && date) {
      const d = new Date(date + "T00:00:00")
      return isNaN(d.getTime()) ? "" : format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    }
    return "Todos os agendamentos"
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">Agendamentos</h1>
        <p className="text-sm text-muted-foreground capitalize">{periodLabel()}</p>
      </div>

      {/* Filtros — Client Component, recebe estado inicial do servidor */}
      <Suspense>
        <AppointmentFilters
          currentSearch={search}
          currentStatus={status}
          currentPeriod={period}
          currentDate={date}
          counts={counts}
        />
      </Suspense>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                {total === 0
                  ? "Nenhum agendamento encontrado"
                  : `${total} agendamento${total !== 1 ? "s" : ""}`}
              </CardTitle>
              {total > APPOINTMENTS_PER_PAGE && (
                <CardDescription>
                  Mostrando {Math.min((page - 1) * APPOINTMENTS_PER_PAGE + 1, total)}–
                  {Math.min(page * APPOINTMENTS_PER_PAGE, total)} de {total}
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {total === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="font-medium text-muted-foreground">
                  {search || status !== "all" || period !== "upcoming"
                    ? "Nenhum agendamento encontrado com esses filtros"
                    : "Nenhum agendamento ainda"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {search || status !== "all" || period !== "upcoming"
                    ? "Tente ajustar os filtros acima."
                    : "Os agendamentos aparecerão aqui conforme os clientes agendarem."}
                </p>
              </div>
            </div>
          ) : (
            <AppointmentsTable appointments={appointmentsWithUsername} />
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      <Suspense>
        <AppointmentsPagination
          currentPage={page}
          totalPages={totalPages}
          total={total}
        />
      </Suspense>
    </div>
  )
}
