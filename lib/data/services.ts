// =============================================
// QUERIES DE SERVIÇOS
// =============================================
// Chamadas exclusivamente em Server Components.

import { prisma } from "@/lib/prisma"

export async function getServices(userId: string) {
  return prisma.service.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      duration: true,
      active: true,
      createdAt: true,
      _count: { select: { appointments: true } },
    },
    orderBy: { name: "asc" },
  })
}

export type ServiceRow = Awaited<ReturnType<typeof getServices>>[number]
