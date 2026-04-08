"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { AppointmentStatus } from "@prisma/client"
import {
  sendTextMessage,
  getBookingConfirmationMessage,
  getBookingCancellationMessage,
  getBookingRescheduleMessage,
  getBookingReminderMessage,
} from "@/lib/evolution"
import {
  generateSlots,
  filterAvailableSlots,
  dateToMinutes,
  DEFAULT_BUSINESS_HOURS,
} from "@/lib/slots"
import { format, parseISO, startOfDay, endOfDay, addMinutes } from "date-fns"
import { ptBR } from "date-fns/locale"

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Busca o agendamento com todos os dados necessários e verifica ownership. */
async function getAppointmentOrThrow(appointmentId: string, userId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      userId: true,
      startTime: true,
      endTime: true,
      status: true,
      serviceId: true,
      service: { select: { name: true, price: true, duration: true } },
      customer: { select: { name: true, phone: true } },
    },
  })

  if (!appointment || appointment.userId !== userId) {
    throw new Error("Agendamento não encontrado.")
  }

  return appointment
}

/** Busca dados do lojista necessários para envio via WhatsApp. */
async function getUserWhatsApp(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      username: true,
      evolutionInstanceName: true,
      evolutionConnected: true,
    },
  })
}

/** Envia mensagem WhatsApp sem bloquear — falha é apenas logada. */
function sendWhatsApp(params: {
  instanceName: string | null
  connected: boolean
  phone: string
  message: string
}) {
  if (!params.connected || !params.instanceName) return
  sendTextMessage({
    instanceName: params.instanceName,
    phoneNumber: params.phone,
    message: params.message,
  }).catch((err) =>
    console.error("[Appointments] Falha no WhatsApp (operação salva):", err)
  )
}

function formatDateLabel(date: Date): string {
  const day = format(date, "EEEE", { locale: ptBR })
  const rest = format(date, "dd/MM/yyyy", { locale: ptBR })
  return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${rest}`
}

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

// ── CONFIRMAR ─────────────────────────────────────────────────────────────────

export async function confirmAppointment(appointmentId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Não autenticado" }

    const [appointment, lojista] = await Promise.all([
      getAppointmentOrThrow(appointmentId, user.id),
      getUserWhatsApp(user.id),
    ])

    if (appointment.status !== AppointmentStatus.PENDING) {
      return { error: "Apenas agendamentos pendentes podem ser confirmados." }
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.CONFIRMED },
    })

    if (lojista) {
      sendWhatsApp({
        instanceName: lojista.evolutionInstanceName,
        connected: lojista.evolutionConnected,
        phone: appointment.customer.phone,
        message: getBookingConfirmationMessage({
          customerName: appointment.customer.name.split(" ")[0],
          serviceName: appointment.service.name,
          date: formatDateLabel(new Date(appointment.startTime)),
          time: format(new Date(appointment.startTime), "HH:mm"),
          businessName: lojista.name,
        }),
      })
    }

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("[confirmAppointment]", error)
    return { error: error instanceof Error ? error.message : "Erro ao confirmar agendamento." }
  }
}

// ── CANCELAR ──────────────────────────────────────────────────────────────────

export async function cancelAppointment(appointmentId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Não autenticado" }

    const [appointment, lojista] = await Promise.all([
      getAppointmentOrThrow(appointmentId, user.id),
      getUserWhatsApp(user.id),
    ])

    if (
      appointment.status !== AppointmentStatus.PENDING &&
      appointment.status !== AppointmentStatus.CONFIRMED
    ) {
      return { error: "Este agendamento não pode ser cancelado." }
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.CANCELLED },
    })

    if (lojista) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
      const bookingUrl = `${appUrl}/${lojista.username}/book`

      sendWhatsApp({
        instanceName: lojista.evolutionInstanceName,
        connected: lojista.evolutionConnected,
        phone: appointment.customer.phone,
        message: getBookingCancellationMessage({
          customerName: appointment.customer.name.split(" ")[0],
          serviceName: appointment.service.name,
          date: formatDateLabel(new Date(appointment.startTime)),
          time: format(new Date(appointment.startTime), "HH:mm"),
          businessName: lojista.name,
          bookingUrl,
        }),
      })
    }

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("[cancelAppointment]", error)
    return { error: error instanceof Error ? error.message : "Erro ao cancelar agendamento." }
  }
}

// ── CONCLUIR ──────────────────────────────────────────────────────────────────

export async function completeAppointment(appointmentId: string) {
  try {
    const userId = await verifyOwnership(appointmentId)

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { status: true },
    })

    if (appointment?.status !== AppointmentStatus.CONFIRMED) {
      return { error: "Apenas agendamentos confirmados podem ser concluídos." }
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.COMPLETED },
    })

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("[completeAppointment]", error)
    return { error: error instanceof Error ? error.message : "Erro ao concluir agendamento." }
  }
}

// ── ENVIAR LEMBRETE ───────────────────────────────────────────────────────────

export async function sendReminderWhatsApp(appointmentId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Não autenticado" }

    const [appointment, lojista] = await Promise.all([
      getAppointmentOrThrow(appointmentId, user.id),
      getUserWhatsApp(user.id),
    ])

    if (!lojista?.evolutionConnected || !lojista.evolutionInstanceName) {
      return { error: "WhatsApp não conectado. Configure em Configurações > WhatsApp." }
    }

    const message = getBookingReminderMessage({
      customerName: appointment.customer.name.split(" ")[0],
      serviceName: appointment.service.name,
      time: format(new Date(appointment.startTime), "HH:mm"),
      businessName: lojista.name
    });

    console.log(`[sendReminderWhatsApp] Enviando lembrete para ${appointment.customer.phone}: ${message}: ${lojista.evolutionInstanceName}`)

    await sendTextMessage({
      instanceName: lojista.evolutionInstanceName,
      phoneNumber: appointment.customer.phone,
      message: message
    })

    return { success: true }
  } catch (error) {
    console.error("[sendReminderWhatsApp]", error)
    return { error: error instanceof Error ? error.message : "Erro ao enviar lembrete." }
  }
}

// ── REAGENDAR ─────────────────────────────────────────────────────────────────

const rescheduleSchema = z.object({
  appointmentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
})

export async function rescheduleAppointment(
  appointmentId: string,
  date: string,
  time: string
) {
  try {
    const parsed = rescheduleSchema.safeParse({ appointmentId, date, time })
    if (!parsed.success) return { error: "Dados inválidos." }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Não autenticado" }

    const [appointment, lojista] = await Promise.all([
      getAppointmentOrThrow(appointmentId, user.id),
      getUserWhatsApp(user.id),
    ])

    if (
      appointment.status !== AppointmentStatus.PENDING &&
      appointment.status !== AppointmentStatus.CONFIRMED
    ) {
      return { error: "Este agendamento não pode ser reagendado." }
    }

    // Valida o novo slot com a mesma lógica do /api/bookings (race condition)
    const newDate = parseISO(date)
    const dayOfWeek = newDate.getDay()

    const businessHours = await prisma.businessHours.findUnique({
      where: { userId_dayOfWeek: { userId: user.id, dayOfWeek } },
      select: { openTime: true, closeTime: true, slotInterval: true, lunchStart: true, lunchEnd: true },
    })

    if (!businessHours && dayOfWeek === 0) {
      return { error: "O estabelecimento não funciona aos domingos." }
    }

    const { openTime, closeTime, slotInterval, lunchStart, lunchEnd } =
      businessHours ?? DEFAULT_BUSINESS_HOURS

    const allSlots = generateSlots({
      openTime,
      closeTime,
      slotInterval,
      serviceDuration: appointment.service.duration,
      lunchStart,
      lunchEnd,
    })

    if (!allSlots.includes(time)) {
      return { error: "Horário inválido para este serviço." }
    }

    // Busca agendamentos do dia EXCLUINDO o próprio (que está sendo remarcado)
    const existing = await prisma.appointment.findMany({
      where: {
        userId: user.id,
        id: { not: appointmentId },
        startTime: { gte: startOfDay(newDate), lte: endOfDay(newDate) },
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
      select: { startTime: true, endTime: true },
    })

    const bookedRanges = existing.map((a) => ({
      start: dateToMinutes(new Date(a.startTime)),
      end: dateToMinutes(new Date(a.endTime)),
    }))

    const available = filterAvailableSlots({
      slots: allSlots,
      bookedRanges,
      serviceDuration: appointment.service.duration,
    })

    if (!available.includes(time)) {
      return { error: "Este horário acabou de ser ocupado. Escolha outro." }
    }

    // Calcula novos startTime e endTime
    const newStart = parseISO(`${date}T${time}:00`)
    const newEnd = addMinutes(newStart, appointment.service.duration)

    const oldStart = new Date(appointment.startTime)

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        date: startOfDay(newDate),
        startTime: newStart,
        endTime: newEnd,
        status: AppointmentStatus.CONFIRMED, // reagendado = automaticamente confirmado
      },
    })

    // Notifica o cliente no WhatsApp
    if (lojista) {
      sendWhatsApp({
        instanceName: lojista.evolutionInstanceName,
        connected: lojista.evolutionConnected,
        phone: appointment.customer.phone,
        message: getBookingRescheduleMessage({
          customerName: appointment.customer.name.split(" ")[0],
          serviceName: appointment.service.name,
          oldDate: formatDateLabel(oldStart),
          oldTime: format(oldStart, "HH:mm"),
          newDate: formatDateLabel(newStart),
          newTime: time,
          businessName: lojista.name,
        }),
      })
    }

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("[rescheduleAppointment]", error)
    return { error: error instanceof Error ? error.message : "Erro ao reagendar." }
  }
}
