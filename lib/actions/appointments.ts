// =============================================
// SERVER ACTIONS — AGENDAMENTOS
// =============================================
// Ações do servidor para gerenciar agendamentos no dashboard.

"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { AppointmentStatus } from "@prisma/client"

// Verifica se o agendamento pertence ao usuário autenticado
async function verifyOwnership(appointmentId: string): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Não autenticado")

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { userId: true },
  })

  if (!appointment || appointment.userId !== user.id) {
    throw new Error("Agendamento não encontrado")
  }

  return user.id
}

// =============================================
// CONFIRMAR AGENDAMENTO
// =============================================
export async function confirmAppointment(appointmentId: string) {
  try {
    await verifyOwnership(appointmentId)

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.CONFIRMED },
    })

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao confirmar agendamento" }
  }
}

// =============================================
// CANCELAR AGENDAMENTO
// =============================================
export async function cancelAppointment(appointmentId: string) {
  try {
    await verifyOwnership(appointmentId)

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.CANCELLED },
    })

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao cancelar agendamento" }
  }
}

// =============================================
// MARCAR COMO CONCLUÍDO
// =============================================
export async function completeAppointment(appointmentId: string) {
  try {
    await verifyOwnership(appointmentId)

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.COMPLETED },
    })

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao concluir agendamento" }
  }
}
