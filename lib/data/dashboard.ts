import { prisma } from "@/lib/prisma"
import { AppointmentStatus } from "@prisma/client"
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from "date-fns"

// =============================================
// AGENDAMENTOS DO DIA
// =============================================
export async function getTodayAppointments(userId: string) {
  const now   = new Date()
  const start = startOfDay(now)
  const end   = endOfDay(now)

  // Busca o username do lojista (necessário para o dialog de reagendamento)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  })

  const appointments = await prisma.appointment.findMany({
    where: {
      userId,
      startTime: { gte: start, lte: end },
      status: { not: AppointmentStatus.CANCELLED },
    },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      status: true,
      notes: true,
      serviceId: true,                                      // para o dialog de reagendamento
      customer: { select: { name: true, phone: true } },
      service: { select: { name: true, duration: true, price: true } },
    },
    orderBy: { startTime: "asc" },
  })

  // Injeta o username em cada appointment para o componente cliente usar
  const username = user?.username ?? ""
  return appointments.map((a) => ({ ...a, username }))
}

// =============================================
// MÉTRICAS DO DASHBOARD
// =============================================
export async function getDashboardStats(userId: string) {
  const now           = new Date()
  const todayStart    = startOfDay(now)
  const todayEnd      = endOfDay(now)
  const monthStart    = startOfMonth(now)
  const monthEnd      = endOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd   = endOfMonth(subMonths(now, 1))
  const yesterday      = startOfDay(new Date(now.getTime() - 86400000))
  const yesterdayEnd   = endOfDay(new Date(now.getTime() - 86400000))

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
    prisma.appointment.count({
      where: {
        userId,
        startTime: { gte: todayStart, lte: todayEnd },
        status: { not: AppointmentStatus.CANCELLED },
      },
    }),
    prisma.appointment.count({
      where: {
        userId,
        startTime: { gte: yesterday, lte: yesterdayEnd },
        status: { not: AppointmentStatus.CANCELLED },
      },
    }),
    prisma.customer.count({ where: { userId } }),
    prisma.customer.count({
      where: { userId, createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.appointment.findMany({
      where: {
        userId,
        startTime: { gte: monthStart, lte: monthEnd },
        status: AppointmentStatus.COMPLETED,
      },
      include: { service: { select: { price: true } } },
    }),
    prisma.appointment.findMany({
      where: {
        userId,
        startTime: { gte: lastMonthStart, lte: lastMonthEnd },
        status: AppointmentStatus.COMPLETED,
      },
      include: { service: { select: { price: true } } },
    }),
    prisma.appointment.count({
      where: {
        userId,
        startTime: { gte: monthStart, lte: monthEnd },
        status: { not: AppointmentStatus.CANCELLED },
      },
    }),
    prisma.appointment.count({
      where: {
        userId,
        startTime: { gte: monthStart, lte: monthEnd },
        status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED] },
      },
    }),
  ])

  const currentMonthRevenue = monthRevenue.reduce(
    (sum, a) => sum + Number(a.service.price), 0
  )
  const previousMonthRevenue = lastMonthRevenue.reduce(
    (sum, a) => sum + Number(a.service.price), 0
  )

  const revenueGrowth =
    previousMonthRevenue > 0
      ? Math.round(((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100)
      : null

  const confirmationRate =
    monthAppointments > 0
      ? Math.round((confirmedAppointments / monthAppointments) * 100)
      : null

  return {
    today:            { count: todayCount, vsYesterday: todayCount - yesterdayCount },
    customers:        { total: totalCustomers, newThisMonth: monthCustomers },
    revenue:          { thisMonth: currentMonthRevenue, growth: revenueGrowth },
    confirmationRate,
  }
}

// =============================================
// PRÓXIMOS AGENDAMENTOS
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
      service:  { select: { name: true, duration: true, price: true } },
    },
    orderBy: { startTime: "asc" },
    take: limit,
  })
}
