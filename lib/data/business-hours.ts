// =============================================
// QUERIES DE HORÁRIOS DE FUNCIONAMENTO
// =============================================

import { prisma } from "@/lib/prisma"

export async function getBusinessHours(userId: string) {
  return prisma.businessHours.findMany({
    where: { userId },
    select: {
      id: true,
      dayOfWeek: true,
      openTime: true,
      closeTime: true,
      slotInterval: true,
      lunchStart: true,
      lunchEnd: true,
    },
    orderBy: { dayOfWeek: "asc" },
  })
}

export type BusinessHoursRow = Awaited<ReturnType<typeof getBusinessHours>>[number]
