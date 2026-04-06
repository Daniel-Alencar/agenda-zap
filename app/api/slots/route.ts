// =============================================
// GET /api/slots
// =============================================
// Query params: username, serviceId, date (YYYY-MM-DD)
// Retorna: { slots: string[], closed: boolean, serviceDuration: number }

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { AppointmentStatus } from "@prisma/client"
import {
  generateSlots,
  filterAvailableSlots,
  dateToMinutes,
  DEFAULT_BUSINESS_HOURS,
} from "@/lib/slots"
import { parseISO, isValid, isBefore, startOfDay, endOfDay, startOfToday } from "date-fns"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const username  = searchParams.get("username")
  const serviceId = searchParams.get("serviceId")
  const dateStr   = searchParams.get("date")

  if (!username || !serviceId || !dateStr) {
    return NextResponse.json(
      { error: "Parâmetros obrigatórios: username, serviceId, date" },
      { status: 400 }
    )
  }

  const date = parseISO(dateStr)
  if (!isValid(date)) {
    return NextResponse.json({ error: "Formato de data inválido. Use YYYY-MM-DD." }, { status: 400 })
  }
  if (isBefore(startOfDay(date), startOfToday())) {
    return NextResponse.json({ error: "Não é possível agendar em datas passadas." }, { status: 400 })
  }

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

  if (!user) return NextResponse.json({ error: "Lojista não encontrado." }, { status: 404 })
  if (!service || service.userId !== user.id) {
    return NextResponse.json({ error: "Serviço não encontrado ou inativo." }, { status: 404 })
  }

  const dayOfWeek = date.getDay()

  const businessHours = await prisma.businessHours.findUnique({
    where: { userId_dayOfWeek: { userId: user.id, dayOfWeek } },
    select: { openTime: true, closeTime: true, slotInterval: true, lunchStart: true, lunchEnd: true },
  })

  if (!businessHours && dayOfWeek === 0) {
    return NextResponse.json({ slots: [], closed: true, reason: "Fechado aos domingos." })
  }

  const { openTime, closeTime, slotInterval, lunchStart, lunchEnd } =
    businessHours ?? DEFAULT_BUSINESS_HOURS

  const allSlots = generateSlots({
    openTime,
    closeTime,
    slotInterval,
    serviceDuration: service.duration,
    lunchStart,
    lunchEnd,
  })

  if (allSlots.length === 0) {
    return NextResponse.json({ slots: [], closed: false, serviceDuration: service.duration })
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

  const available = filterAvailableSlots({
    slots: allSlots,
    bookedRanges,
    serviceDuration: service.duration,
  })

  // Remove slots passados se for hoje
  const isToday = startOfDay(date).getTime() === startOfToday().getTime()
  const now     = new Date()
  const cutoff  = now.getHours() * 60 + now.getMinutes() + 30

  const final = isToday
    ? available.filter((s) => {
        const [h, m] = s.split(":").map(Number)
        return h * 60 + m >= cutoff
      })
    : available

  return NextResponse.json({ slots: final, closed: false, serviceDuration: service.duration })
}
