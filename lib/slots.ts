// =============================================
// LÓGICA DE CÁLCULO DE SLOTS DISPONÍVEIS
// =============================================
// Funções puras — sem dependência do Prisma ou Next.js.
// Fáceis de testar e reutilizar.

/**
 * Gera todos os slots de início possíveis para um dia,
 * com base no horário de funcionamento e no intervalo entre slots.
 *
 * Ex: openTime="09:00", closeTime="18:00", slotInterval=30, serviceDuration=60
 * Retorna: ["09:00","09:30","10:00",...,"17:00"]
 * (último slot começa em 17:00 para terminar às 18:00)
 */
export function generateSlots({
  openTime,
  closeTime,
  slotInterval,
  serviceDuration,
}: {
  openTime: string      // "HH:MM"
  closeTime: string     // "HH:MM"
  slotInterval: number  // minutos entre inícios de slots
  serviceDuration: number // duração do serviço em minutos
}): string[] {
  const slots: string[] = []

  const [openH, openM] = openTime.split(":").map(Number)
  const [closeH, closeM] = closeTime.split(":").map(Number)

  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  // O último slot precisa caber inteiro antes do fechamento
  const lastPossibleStart = closeMinutes - serviceDuration

  for (let t = openMinutes; t <= lastPossibleStart; t += slotInterval) {
    const h = Math.floor(t / 60).toString().padStart(2, "0")
    const m = (t % 60).toString().padStart(2, "0")
    slots.push(`${h}:${m}`)
  }

  return slots
}

/**
 * Verifica se dois intervalos de tempo se sobrepõem.
 * Usa minutos desde meia-noite para comparação exata.
 */
function overlaps(
  startA: number, endA: number,
  startB: number, endB: number
): boolean {
  // Sobreposição real: A começa antes de B terminar E B começa antes de A terminar
  return startA < endB && startB < endA
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

/**
 * Filtra os slots removendo qualquer um que se sobreponha
 * a um agendamento existente.
 *
 * @param slots       Lista de "HH:MM" gerada por generateSlots
 * @param bookedRanges Lista de {start, end} em minutos desde meia-noite
 * @param serviceDuration Duração do serviço em minutos
 */
export function filterAvailableSlots({
  slots,
  bookedRanges,
  serviceDuration,
}: {
  slots: string[]
  bookedRanges: Array<{ start: number; end: number }>
  serviceDuration: number
}): string[] {
  return slots.filter((slot) => {
    const slotStart = timeToMinutes(slot)
    const slotEnd = slotStart + serviceDuration

    // O slot está livre se não se sobrepõe a nenhum agendamento existente
    return !bookedRanges.some(({ start, end }) =>
      overlaps(slotStart, slotEnd, start, end)
    )
  })
}

/**
 * Converte um Date (com fuso horário já considerado) para minutos desde meia-noite.
 */
export function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/**
 * Horários de funcionamento padrão usados como fallback
 * quando o lojista ainda não configurou os horários.
 * Segunda a sábado, 09:00–18:00, slots de 30 em 30 min.
 */
export const DEFAULT_BUSINESS_HOURS = {
  openTime: "09:00",
  closeTime: "18:00",
  slotInterval: 30,
}
