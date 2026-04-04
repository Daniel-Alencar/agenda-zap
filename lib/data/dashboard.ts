// =============================================
// QUERIES DO DASHBOARD
// =============================================
// Todas as queries Prisma do dashboard centralizadas aqui.
// Chamadas exclusivamente em Server Components — nunca no cliente.

import { prisma } from "@/lib/prisma"
import { AppointmentStatus } from "@prisma/client"
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from "date-fns"

// =============================================
// AGENDAMENTOS DO DIA
// =============================================
export async function getTodayAppointments(userId: string) {
  const now = new Date()
  const start = startOfDay(now)
  const end = endOfDay(now)

  return prisma.appointment.findMany({
    where: {
      userId,
      startTime: { gte: start, lte: end },
      status: { not: AppointmentStatus.CANCELLED },
    },
    include: {
      customer: { select: { name: true, phone: true } },
      service: { select: { name: true, duration: true, price: true } },
    },
    orderBy: { startTime: "asc" },
  })
}

// =============================================
// MÉTRICAS DO DASHBOARD
// =============================================
export async function getDashboardStats(userId: string) {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = endOfMonth(subMonths(now, 1))
  const yesterday = startOfDay(new Date(now.getTime() - 86400000))
  const yesterdayEnd = endOfDay(new Date(now.getTime() - 86400000))

  const [
    todayCount,
    yesterdayCount,
    totalCustomers,
    monthCustomers,
    monthRevenue,
    lastMonthRevenue,
    monthAppointments,
    confirmedAppointments,
  ] = await Promise.all([
    // Agendamentos hoje (não cancelados)
    prisma.appointment.count({
      where: {
        userId,
        startTime: { gte: todayStart, lte: todayEnd },
        status: { not: AppointmentStatus.CANCELLED },
      },
    }),

    // Agendamentos ontem (para comparação)
    prisma.appointment.count({
      where: {
        userId,
        startTime: { gte: yesterday, lte: yesterdayEnd },
        status: { not: AppointmentStatus.CANCELLED },
      },
    }),

    // Total de clientes cadastrados
    prisma.customer.count({ where: { userId } }),

    // Clientes novos este mês
    prisma.customer.count({
      where: { userId, createdAt: { gte: monthStart, lte: monthEnd } },
    }),

    // Receita do mês atual (agendamentos concluídos)
    prisma.appointment.findMany({
      where: {
        userId,
        startTime: { gte: monthStart, lte: monthEnd },
        status: AppointmentStatus.COMPLETED,
      },
      include: { service: { select: { price: true } } },
    }),

    // Receita do mês passado (para comparação)
    prisma.appointment.findMany({
      where: {
        userId,
        startTime: { gte: lastMonthStart, lte: lastMonthEnd },
        status: AppointmentStatus.COMPLETED,
      },
      include: { service: { select: { price: true } } },
    }),

    // Total de agendamentos no mês (não cancelados)
    prisma.appointment.count({
      where: {
        userId,
        startTime: { gte: monthStart, lte: monthEnd },
        status: { not: AppointmentStatus.CANCELLED },
      },
    }),

    // Agendamentos confirmados no mês
    prisma.appointment.count({
      where: {
        userId,
        startTime: { gte: monthStart, lte: monthEnd },
        status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED] },
      },
    }),
  ])

  // Calcula receita somando os preços dos serviços
  const currentMonthRevenue = monthRevenue.reduce(
    (sum, a) => sum + Number(a.service.price),
    0
  )
  const previousMonthRevenue = lastMonthRevenue.reduce(
    (sum, a) => sum + Number(a.service.price),
    0
  )

  // Variação percentual de receita
  const revenueGrowth =
    previousMonthRevenue > 0
      ? Math.round(
          ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
        )
      : null

  // Taxa de confirmação (confirmados + concluídos / total não cancelados)
  const confirmationRate =
    monthAppointments > 0
      ? Math.round((confirmedAppointments / monthAppointments) * 100)
      : null

  return {
    today: {
      count: todayCount,
      vsYesterday: todayCount - yesterdayCount,
    },
    customers: {
      total: totalCustomers,
      newThisMonth: monthCustomers,
    },
    revenue: {
      thisMonth: currentMonthRevenue,
      growth: revenueGrowth,
    },
    confirmationRate,
  }
}

// =============================================
// PRÓXIMOS AGENDAMENTOS (para listagem futura)
// =============================================
export async function getUpcomingAppointments(userId: string, limit = 10) {
  return prisma.appointment.findMany({
    where: {
      userId,
      startTime: { gte: new Date() },
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
    },
    include: {
      customer: { select: { name: true, phone: true } },
      service: { select: { name: true, duration: true, price: true } },
    },
    orderBy: { startTime: "asc" },
    take: limit,
  })
}
