// =============================================
// POST /api/bookings
// =============================================
// Cria um agendamento, registra o cliente e dispara
// a confirmação no WhatsApp do cliente.
//
// Body (JSON):
//   username       — identificador público do lojista
//   serviceId      — ID do serviço
//   date           — "YYYY-MM-DD"
//   time           — "HH:MM"
//   customerName   — nome do cliente
//   customerPhone  — somente dígitos, com DDI (ex: "5511999999999")
//   notes          — observações opcionais

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { AppointmentStatus } from "@prisma/client"
import { sendTextMessage, getBookingConfirmationMessage } from "@/lib/evolution"
import { generateSlots, filterAvailableSlots, dateToMinutes, DEFAULT_BUSINESS_HOURS } from "@/lib/slots"
import { parseISO, isValid, isBefore, startOfToday, startOfDay, endOfDay, addMinutes } from "date-fns"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

// ── Validação do body ─────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Combina uma data YYYY-MM-DD com HH:MM e retorna um Date em UTC. */
function buildDateTime(dateStr: string, timeStr: string): Date {
  // parseISO("2026-04-10T09:00:00") — sem sufixo de fuso trata como local
  return parseISO(`${dateStr}T${timeStr}:00`)
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // 1. Parse e validação do body
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

  // 2. Validação da data
  const date = parseISO(dateStr)
  if (!isValid(date)) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 })
  }
  if (isBefore(startOfDay(date), startOfToday())) {
    return NextResponse.json({ error: "Não é possível agendar em datas passadas." }, { status: 400 })
  }

  // 3. Busca lojista e serviço em paralelo
  const [user, service] = await Promise.all([
    prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: {
        id: true,
        name: true,
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

  // 4. Verifica race condition — o slot ainda está disponível?
  //    Roda a mesma lógica do GET /api/slots no momento exato do submit.
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

  // Agendamentos ativos do dia
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

  const availableSlots = filterAvailableSlots({
    slots: allSlots,
    bookedRanges,
    serviceDuration: service.duration,
  })

  if (!availableSlots.includes(time)) {
    return NextResponse.json(
      { error: "Este horário acabou de ser ocupado. Por favor, escolha outro." },
      { status: 409 }
    )
  }

  // 5. Calcula startTime e endTime
  const startTime = buildDateTime(dateStr, time)
  const endTime   = addMinutes(startTime, service.duration)

  // 6. Upsert do Customer + criação do Appointment em uma transaction
  //    Se qualquer operação falhar, nada é salvo.
  let appointment: { id: string }
  try {
    appointment = await prisma.$transaction(async (tx) => {
      // Cria ou atualiza o cliente (pode retornar na mesma sessão ou ser novo)
      const customer = await tx.customer.upsert({
        where: { phone_userId: { phone: customerPhone, userId: user.id } },
        update: { name: customerName, lastMessageAt: new Date() },
        create: {
          name:  customerName,
          phone: customerPhone,
          userId: user.id,
          lastMessageAt: new Date(),
        },
      })

      // Cria o agendamento
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
    return NextResponse.json(
      { error: "Erro ao salvar o agendamento. Tente novamente." },
      { status: 500 }
    )
  }

  // 7. Envia confirmação no WhatsApp — FORA da transaction.
  //    Falha no WhatsApp não cancela o agendamento já criado.
  if (user.evolutionConnected && user.evolutionInstanceName) {
    const dateFormatted = format(date, "dd/MM/yyyy", { locale: ptBR })
    const dayFormatted  = format(date, "EEEE", { locale: ptBR })
    // "segunda-feira, 10/04/2026"
    const dateLabel = `${dayFormatted.charAt(0).toUpperCase() + dayFormatted.slice(1)}, ${dateFormatted}`

    const message = getBookingConfirmationMessage({
      customerName: customerName.split(" ")[0], // só o primeiro nome
      serviceName:  service.name,
      date:         dateLabel,
      time,
      businessName: user.name,
    })

    sendTextMessage({
      instanceName: user.evolutionInstanceName,
      phoneNumber:  customerPhone,
      message,
    }).catch((err) =>
      console.error("[Bookings] Falha ao enviar WhatsApp (agendamento salvo):", err)
    )
  }

  // 8. Responde com sucesso
  return NextResponse.json(
    {
      success: true,
      appointmentId: appointment.id,
      message: "Agendamento realizado com sucesso.",
    },
    { status: 201 }
  )
}
