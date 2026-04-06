"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// ── Validação ─────────────────────────────────────────────────────────────────

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

const daySchema = z.object({
  dayOfWeek:    z.number().int().min(0).max(6),
  open:         z.boolean(),
  openTime:     z.string().regex(timeRegex, "Horário inválido"),
  closeTime:    z.string().regex(timeRegex, "Horário inválido"),
  slotInterval: z.number().int().min(10).max(120),
  hasLunch:     z.boolean(),
  lunchStart:   z.string().regex(timeRegex, "Horário inválido").nullable(),
  lunchEnd:     z.string().regex(timeRegex, "Horário inválido").nullable(),
}).superRefine((val, ctx) => {
  if (!val.open) return // dia fechado — não valida horários

  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number)
    return h * 60 + m
  }

  if (toMin(val.openTime) >= toMin(val.closeTime)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Abertura deve ser antes do fechamento.",
      path: ["closeTime"],
    })
  }

  if (val.hasLunch && val.lunchStart && val.lunchEnd) {
    if (toMin(val.lunchStart) >= toMin(val.lunchEnd)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Início do almoço deve ser antes do fim.",
        path: ["lunchEnd"],
      })
    }
    if (toMin(val.lunchStart) <= toMin(val.openTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Almoço deve ser após a abertura.",
        path: ["lunchStart"],
      })
    }
    if (toMin(val.lunchEnd) >= toMin(val.closeTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Almoço deve terminar antes do fechamento.",
        path: ["lunchEnd"],
      })
    }
  }
})

const schema = z.array(daySchema).length(7)

export type DayPayload = z.infer<typeof daySchema>

// ── Action ────────────────────────────────────────────────────────────────────

export async function saveBusinessHours(days: DayPayload[]) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Não autenticado." }

    const parsed = schema.safeParse(days)
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Dados inválidos."
      return { error: msg }
    }

    // Persiste com upsert em paralelo.
    // Dias marcados como fechados são DELETADOS (sem registro = fechado).
    // Dias abertos são criados/atualizados.
    await prisma.$transaction(
      parsed.data.map((day) => {
        if (!day.open) {
          // Remove o registro se existir
          return prisma.businessHours.deleteMany({
            where: { userId: user.id, dayOfWeek: day.dayOfWeek },
          })
        }

        const data = {
          openTime:     day.openTime,
          closeTime:    day.closeTime,
          slotInterval: day.slotInterval,
          lunchStart:   day.hasLunch ? day.lunchStart : null,
          lunchEnd:     day.hasLunch ? day.lunchEnd   : null,
        }

        return prisma.businessHours.upsert({
          where: { userId_dayOfWeek: { userId: user.id, dayOfWeek: day.dayOfWeek } },
          update: data,
          create: { ...data, dayOfWeek: day.dayOfWeek, userId: user.id },
        })
      })
    )

    revalidatePath("/dashboard/settings")
    return { success: true }
  } catch (err) {
    console.error("[BusinessHours] save:", err)
    return { error: "Erro ao salvar. Tente novamente." }
  }
}
