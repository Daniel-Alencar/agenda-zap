// =============================================
// LÓGICA DE CÁLCULO DE SLOTS DISPONÍVEIS
// =============================================

/** Converte "HH:MM" → minutos desde meia-noite */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

/** Converte um Date para minutos desde meia-noite */
export function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** Verifica sobreposição entre dois intervalos (em minutos) */
function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA
}

/**
 * Gera todos os slots de início possíveis para um dia.
 * O último slot garante que o serviço termina antes do fechamento.
 * Slots que se sobreponham ao intervalo de almoço são excluídos.
 */
export function generateSlots({
  openTime,
  closeTime,
  slotInterval,
  serviceDuration,
  lunchStart,
  lunchEnd,
}: {
  openTime:        string
  closeTime:       string
  slotInterval:    number
  serviceDuration: number
  lunchStart?:     string | null
  lunchEnd?:       string | null
}): string[] {
  const openMin       = timeToMinutes(openTime)
  const closeMin      = timeToMinutes(closeTime)
  const lastStart     = closeMin - serviceDuration

  const lunchStartMin = lunchStart ? timeToMinutes(lunchStart) : null
  const lunchEndMin   = lunchEnd   ? timeToMinutes(lunchEnd)   : null
  const hasLunch      = lunchStartMin !== null && lunchEndMin !== null

  const slots: string[] = []

  for (let t = openMin; t <= lastStart; t += slotInterval) {
    const slotEnd = t + serviceDuration

    // Exclui qualquer slot cujo atendimento se sobreponha ao almoço
    if (hasLunch && overlaps(t, slotEnd, lunchStartMin!, lunchEndMin!)) {
      continue
    }

    const h = Math.floor(t / 60).toString().padStart(2, "0")
    const m = (t % 60).toString().padStart(2, "0")
    slots.push(`${h}:${m}`)
  }

  return slots
}

/**
 * Remove slots que se sobrepõem a agendamentos existentes.
 */
export function filterAvailableSlots({
  slots,
  bookedRanges,
  serviceDuration,
}: {
  slots:           string[]
  bookedRanges:    Array<{ start: number; end: number }>
  serviceDuration: number
}): string[] {
  return slots.filter((slot) => {
    const start = timeToMinutes(slot)
    const end   = start + serviceDuration
    return !bookedRanges.some(({ start: bs, end: be }) => overlaps(start, end, bs, be))
  })
}

export const DEFAULT_BUSINESS_HOURS = {
  openTime:     "09:00",
  closeTime:    "18:00",
  slotInterval: 30,
  lunchStart:   null,
  lunchEnd:     null,
}
