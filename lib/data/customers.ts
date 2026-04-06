// =============================================
// QUERIES DE CLIENTES
// =============================================

import { prisma } from "@/lib/prisma"
import { AppointmentStatus } from "@prisma/client"

export const CUSTOMERS_PER_PAGE = 20

export type CustomerFilter = "all" | "active" | "inactive"

/**
 * Lista paginada de clientes com métricas agregadas.
 * "active"   = tem agendamento futuro PENDING ou CONFIRMED
 * "inactive" = nenhum agendamento futuro ativo
 */
export async function getCustomers(
  userId: string,
  {
    search = "",
    filter = "all",
    page = 1,
  }: { search?: string; filter?: CustomerFilter; page?: number } = {}
) {
  const skip = (page - 1) * CUSTOMERS_PER_PAGE

  // IDs de clientes com agendamentos futuros ativos (usado para filtro active/inactive)
  const activeCustomerIds =
    filter !== "all"
      ? await prisma.appointment
          .findMany({
            where: {
              userId,
              startTime: { gte: new Date() },
              status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
            },
            select: { customerId: true },
            distinct: ["customerId"],
          })
          .then((rows) => rows.map((r) => r.customerId))
      : null

  const where = {
    userId,
    ...(search.trim()
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(filter === "active" && activeCustomerIds
      ? { id: { in: activeCustomerIds } }
      : {}),
    ...(filter === "inactive" && activeCustomerIds
      ? { id: { notIn: activeCustomerIds.length ? activeCustomerIds : ["__none__"] } }
      : {}),
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        appointments: {
          select: { id: true, startTime: true, status: true },
          orderBy: { startTime: "desc" },
          take: 1,
        },
        _count: { select: { appointments: true } },
      },
      orderBy: { name: "asc" },
      skip,
      take: CUSTOMERS_PER_PAGE,
    }),
    prisma.customer.count({ where }),
  ])

  return {
    customers,
    total,
    totalPages: Math.ceil(total / CUSTOMERS_PER_PAGE),
  }
}

export type CustomerRow = Awaited<ReturnType<typeof getCustomers>>["customers"][number]

/**
 * Detalhe completo de um cliente com histórico de agendamentos.
 * Retorna null se o cliente não pertencer ao userId.
 */
export async function getCustomerDetail(customerId: string, userId: string) {
  return prisma.customer.findFirst({
    where: { id: customerId, userId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      createdAt: true,
      appointments: {
        select: {
          id: true,
          startTime: true,
          endTime: true,
          status: true,
          notes: true,
          service: { select: { name: true, price: true, duration: true } },
        },
        orderBy: { startTime: "desc" },
      },
    },
  })
}

export type CustomerDetail = NonNullable<Awaited<ReturnType<typeof getCustomerDetail>>>
