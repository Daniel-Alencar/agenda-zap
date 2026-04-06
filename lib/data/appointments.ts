import { prisma } from "@/lib/prisma"
import { AppointmentStatus } from "@prisma/client"
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  parseISO, isValid,
} from "date-fns"
import { ptBR } from "date-fns/locale"

export const APPOINTMENTS_PER_PAGE = 25

export type StatusFilter = "all" | "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED"
export type PeriodFilter = "today" | "week" | "month" | "custom" | "upcoming" | "all"

function buildDateRange(period: PeriodFilter, customDate?: string): {
  gte?: Date; lte?: Date
} | null {
  const now = new Date()
  switch (period) {
    case "today":
      return { gte: startOfDay(now), lte: endOfDay(now) }
    case "week":
      return {
        gte: startOfWeek(now, { locale: ptBR }),
        lte: endOfWeek(now, { locale: ptBR }),
      }
    case "month":
      return { gte: startOfMonth(now), lte: endOfMonth(now) }
    case "upcoming":
      return { gte: startOfDay(now) }
    case "custom": {
      if (!customDate) return null
      const d = parseISO(customDate)
      if (!isValid(d)) return null
      return { gte: startOfDay(d), lte: endOfDay(d) }
    }
    default:
      return null // "all" — sem filtro de data
  }
}

export async function getAppointments(
  userId: string,
  {
    search   = "",
    status   = "all" as StatusFilter,
    period   = "upcoming" as PeriodFilter,
    date     = "",
    page     = 1,
  }: {
    search?: string
    status?: StatusFilter
    period?: PeriodFilter
    date?: string
    page?: number
  } = {}
) {
  const skip = (page - 1) * APPOINTMENTS_PER_PAGE
  const dateRange = buildDateRange(period, date)

  const where = {
    userId,
    ...(dateRange ? { startTime: dateRange } : {}),
    ...(status !== "all"
      ? { status: status as AppointmentStatus }
      : {}),
    ...(search.trim()
      ? {
          OR: [
            { customer: { name: { contains: search, mode: "insensitive" as const } } },
            { customer: { phone: { contains: search } } },
            { service: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        notes: true,
        serviceId: true,
        customer: { select: { name: true, phone: true } },
        service:  { select: { name: true, duration: true, price: true } },
      },
      orderBy: { startTime: period === "all" || period === "upcoming" ? "asc" : "asc" },
      skip,
      take: APPOINTMENTS_PER_PAGE,
    }),
    prisma.appointment.count({ where }),
  ])

  return {
    appointments,
    total,
    totalPages: Math.ceil(total / APPOINTMENTS_PER_PAGE),
  }
}

export type AppointmentRow = Awaited<
  ReturnType<typeof getAppointments>
>["appointments"][number]

/** Contagem por status para os badges do filtro */
export async function getAppointmentCounts(userId: string) {
  const now = new Date()

  const [pending, confirmed, upcoming] = await Promise.all([
    prisma.appointment.count({
      where: { userId, status: AppointmentStatus.PENDING, startTime: { gte: now } },
    }),
    prisma.appointment.count({
      where: { userId, status: AppointmentStatus.CONFIRMED, startTime: { gte: now } },
    }),
    prisma.appointment.count({
      where: {
        userId,
        startTime: { gte: startOfDay(now) },
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
    }),
  ])

  return { pending, confirmed, upcoming }
}
