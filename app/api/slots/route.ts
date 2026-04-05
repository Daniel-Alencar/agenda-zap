// =============================================
// GET /api/slots
// =============================================
// Retorna os horários disponíveis para agendamento.
//
// Query params obrigatórios:
//   username   — identificador público do lojista (ex: "joaobarber")
//   serviceId  — ID do serviço escolhido
//   date       — data no formato YYYY-MM-DD (ex: "2026-04-10")
//
// Resposta 200:
//   { slots: ["09:00","09:30","10:00",...], serviceDuration: 45 }
//
// Resposta 400: parâmetros inválidos
// Resposta 404: lojista ou serviço não encontrado
// Resposta 409: dia fechado (sem horário configurado e domingo)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { AppointmentStatus } from "@prisma/client"
import {
  generateSlots,
  filterAvailableSlots,
  dateToMinutes,
  DEFAULT_BUSINESS_HOURS,
} from "@/lib/slots"
import { startOfDay, endOfDay, parseISO, isValid, isBefore, startOfToday } from "date-fns"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const username  = searchParams.get("username")
  const serviceId = searchParams.get("serviceId")
  const dateStr   = searchParams.get("date")

  // ── Validação de parâmetros ──────────────────────────────────────────────
  if (!username || !serviceId || !dateStr) {
    return NextResponse.json(
      { error: "Parâmetros obrigatórios: username, serviceId, date" },
      { status: 400 }
    )
  }

  const date = parseISO(dateStr) // espera YYYY-MM-DD
  if (!isValid(date)) {
    return NextResponse.json(
      { error: "Formato de data inválido. Use YYYY-MM-DD." },
      { status: 400 }
    )
  }

  // Não aceita datas no passado
  if (isBefore(startOfDay(date), startOfToday())) {
    return NextResponse.json(
      { error: "Não é possível agendar em datas passadas." },
      { status: 400 }
    )
  }

  // ── Busca lojista + serviço em paralelo ──────────────────────────────────
  const [user, service] = await Promise.all([
    prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    }),
    prisma.service.findFirst({
      where: { id: serviceId, active: true },
      select: { id: true, duration: true, userId: true },
    }),
  ])

  if (!user) {
    return NextResponse.json({ error: "Lojista não encontrado." }, { status: 404 })
  }

  if (!service || service.userId !== user.id) {
    return NextResponse.json(
      { error: "Serviço não encontrado ou inativo." },
      { status: 404 }
    )
  }

  // ── Horário de funcionamento do dia ──────────────────────────────────────
  const dayOfWeek = date.getDay() // 0 = domingo, 6 = sábado

  const businessHours = await prisma.businessHours.findUnique({
    where: { userId_dayOfWeek: { userId: user.id, dayOfWeek } },
    select: { openTime: true, closeTime: true, slotInterval: true },
  })

  // Fallback: domingo sempre fecha; demais dias usam padrão se não configurado
  if (!businessHours) {
    if (dayOfWeek === 0) {
      return NextResponse.json(
        { slots: [], closed: true, reason: "Fechado aos domingos." },
        { status: 200 }
      )
    }
    // Usa horário padrão para dias não configurados
  }

  const { openTime, closeTime, slotInterval } = businessHours ?? DEFAULT_BUSINESS_HOURS

  // ── Gera todos os slots teóricos do dia ──────────────────────────────────
  const allSlots = generateSlots({
    openTime,
    closeTime,
    slotInterval,
    serviceDuration: service.duration,
  })

  if (allSlots.length === 0) {
    return NextResponse.json({ slots: [], closed: false, serviceDuration: service.duration })
  }

  // ── Busca agendamentos ativos do dia ─────────────────────────────────────
  const dayStart = startOfDay(date)
  const dayEnd   = endOfDay(date)

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      userId: user.id,
      startTime: { gte: dayStart, lte: dayEnd },
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
    },
    select: { startTime: true, endTime: true },
  })

  // Converte para minutos desde meia-noite para comparação
  const bookedRanges = existingAppointments.map((a) => ({
    start: dateToMinutes(new Date(a.startTime)),
    end:   dateToMinutes(new Date(a.endTime)),
  }))

  // ── Filtra slots disponíveis ──────────────────────────────────────────────
  const availableSlots = filterAvailableSlots({
    slots: allSlots,
    bookedRanges,
    serviceDuration: service.duration,
  })

  // ── Se for hoje, remove slots que já passaram ────────────────────────────
  const isToday = startOfDay(date).getTime() === startOfToday().getTime()
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  // Adiciona 30 min de margem para não mostrar slot prestes a começar
  const cutoff = currentMinutes + 30

  const finalSlots = isToday
    ? availableSlots.filter((slot) => {
        const [h, m] = slot.split(":").map(Number)
        return h * 60 + m >= cutoff
      })
    : availableSlots

  return NextResponse.json({
    slots: finalSlots,
    closed: false,
    serviceDuration: service.duration,
  })
}
