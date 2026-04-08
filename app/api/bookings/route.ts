import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { AppointmentStatus } from "@prisma/client"
import { sendTextMessage, getBookingConfirmationMessage } from "@/lib/evolution"
import { generateSlots, filterAvailableSlots, dateToMinutes, DEFAULT_BUSINESS_HOURS } from "@/lib/slots"
import { parseISO, isValid, isBefore, startOfToday, startOfDay, endOfDay, addMinutes } from "date-fns"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

const bookingSchema = z.object({
  username:      z.string().min(1),
  serviceId:     z.string().min(1),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato inválido. Use YYYY-MM-DD."),
  time:          z.string().regex(/^\d{2}:\d{2}$/, "Formato inválido. Use HH:MM."),
  customerName:  z.string().min(2, "Nome deve ter pelo menos 2 caracteres."),
  customerPhone: z
    .string()
    .regex(/^\d{10,15}$/, "Telefone inválido. Envie somente dígitos com DDI (ex: 5511999999999)."),
  notes: z.string().max(500).optional(),
})

function buildDateTime(dateStr: string, timeStr: string): Date {
  return parseISO(`${dateStr}T${timeStr}:00`)
}

/** Gera mensagem de notificação para o lojista sobre novo agendamento. */
function getOwnerNotificationMessage(data: {
  customerName: string
  customerPhone: string
  serviceName: string
  date: string
  time: string
}): string {
  const phoneFormatted = data.customerPhone.replace(/^55/, "")
  return `📅 *Novo agendamento!*

*Cliente:* ${data.customerName}
*WhatsApp:* ${phoneFormatted}
*Serviço:* ${data.serviceName}
*Data:* ${data.date}
*Horário:* ${data.time}

Acesse o painel para confirmar.`
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 })
  }

  const parsed = bookingSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "Dados inválidos."
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { username, serviceId, date: dateStr, time, customerName, customerPhone, notes } = parsed.data

  const date = parseISO(dateStr)
  if (!isValid(date)) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 })
  }
  if (isBefore(startOfDay(date), startOfToday())) {
    return NextResponse.json({ error: "Não é possível agendar em datas passadas." }, { status: 400 })
  }

  const [user, service] = await Promise.all([
    prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: {
        id: true,
        name: true,
        phone: true,                   // número pessoal do lojista para notificação
        evolutionInstanceName: true,
        evolutionConnected: true,
      },
    }),
    prisma.service.findFirst({
      where: { id: serviceId, active: true },
      select: { id: true, name: true, duration: true, price: true, userId: true },
    }),
  ])

  if (!user) {
    return NextResponse.json({ error: "Lojista não encontrado." }, { status: 404 })
  }
  if (!service || service.userId !== user.id) {
    return NextResponse.json({ error: "Serviço não encontrado ou inativo." }, { status: 404 })
  }

  const dayOfWeek = date.getDay()
  const businessHours = await prisma.businessHours.findUnique({
    where: { userId_dayOfWeek: { userId: user.id, dayOfWeek } },
    select: { openTime: true, closeTime: true, slotInterval: true, lunchStart: true, lunchEnd: true },
  })

  if (!businessHours && dayOfWeek === 0) {
    return NextResponse.json({ error: "O estabelecimento não funciona aos domingos." }, { status: 409 })
  }

  const { openTime, closeTime, slotInterval, lunchStart, lunchEnd } = businessHours ?? DEFAULT_BUSINESS_HOURS

  const allSlots = generateSlots({ openTime, closeTime, slotInterval, serviceDuration: service.duration, lunchStart, lunchEnd })
  if (!allSlots.includes(time)) {
    return NextResponse.json({ error: "Horário inválido para este serviço." }, { status: 409 })
  }

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      userId: user.id,
      startTime: { gte: startOfDay(date), lte: endOfDay(date) },
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
    },
    select: { startTime: true, endTime: true },
  })

  const bookedRanges = existingAppointments.map((a) => ({
    start: dateToMinutes(new Date(a.startTime)),
    end:   dateToMinutes(new Date(a.endTime)),
  }))

  const availableSlots = filterAvailableSlots({ slots: allSlots, bookedRanges, serviceDuration: service.duration })

  if (!availableSlots.includes(time)) {
    return NextResponse.json(
      { error: "Este horário acabou de ser ocupado. Por favor, escolha outro." },
      { status: 409 }
    )
  }

  const startTime = buildDateTime(dateStr, time)
  const endTime   = addMinutes(startTime, service.duration)

  let appointment: { id: string }
  try {
    appointment = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { phone_userId: { phone: customerPhone, userId: user.id } },
        update: { name: customerName, lastMessageAt: new Date() },
        create: { name: customerName, phone: customerPhone, userId: user.id, lastMessageAt: new Date() },
      })

      return tx.appointment.create({
        data: {
          date:       startOfDay(date),
          startTime,
          endTime,
          status:     AppointmentStatus.PENDING,
          notes:      notes ?? null,
          userId:     user.id,
          serviceId:  service.id,
          customerId: customer.id,
        },
        select: { id: true },
      })
    })
  } catch (err) {
    console.error("[Bookings] Erro na transaction:", err)
    return NextResponse.json({ error: "Erro ao salvar o agendamento. Tente novamente." }, { status: 500 })
  }

  // ── Mensagens WhatsApp — fora da transaction ─────────────────────────────
  if (user.evolutionConnected && user.evolutionInstanceName) {
    const dateFormatted = format(date, "dd/MM/yyyy", { locale: ptBR })
    const dayFormatted  = format(date, "EEEE", { locale: ptBR })
    const dateLabel     = `${dayFormatted.charAt(0).toUpperCase() + dayFormatted.slice(1)}, ${dateFormatted}`

    // 1. Confirmação para o cliente
    sendTextMessage({
      instanceName: user.evolutionInstanceName,
      phoneNumber:  customerPhone,
      message: getBookingConfirmationMessage({
        customerName: customerName.split(" ")[0],
        serviceName:  service.name,
        date:         dateLabel,
        time,
        businessName: user.name,
      }),
    }).catch((err) => console.error("[Bookings] Falha ao notificar cliente:", err))

    // 2. Notificação para o lojista — só se tiver número cadastrado
    // O lojista recebe no próprio WhatsApp pessoal, via a mesma instância conectada.
    if (user.phone) {
      sendTextMessage({
        instanceName: user.evolutionInstanceName,
        phoneNumber:  user.phone,
        message: getOwnerNotificationMessage({
          customerName,
          customerPhone,
          serviceName: service.name,
          date:        dateLabel,
          time,
        }),
      }).catch((err) => console.error("[Bookings] Falha ao notificar lojista:", err))
    }
  }

  return NextResponse.json(
    { success: true, appointmentId: appointment.id, message: "Agendamento realizado com sucesso." },
    { status: 201 }
  )
}
