"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { AppointmentStatus } from "@prisma/client"

async function getAuthUserId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Não autenticado")
  return user.id
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteCustomer(customerId: string) {
  try {
    const userId = await getAuthUserId()

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, userId },
      select: { id: true },
    })
    if (!customer) return { error: "Cliente não encontrado." }

    // Bloqueia exclusão se houver agendamentos futuros ativos
    const futureCount = await prisma.appointment.count({
      where: {
        customerId,
        startTime: { gte: new Date() },
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
    })
    if (futureCount > 0) {
      return {
        error: `Este cliente tem ${futureCount} agendamento(s) futuro(s) ativo(s). Cancele-os antes de excluir.`,
      }
    }

    await prisma.customer.delete({ where: { id: customerId } })
    revalidatePath("/dashboard/customers")
    return { success: true }
  } catch (err) {
    console.error("[Customers] deleteCustomer:", err)
    return { error: "Erro ao excluir cliente. Tente novamente." }
  }
}
