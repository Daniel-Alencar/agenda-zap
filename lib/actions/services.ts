"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getAuthUserId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Não autenticado")
  return user.id
}

/** Verifica que o serviço pertence ao usuário autenticado. */
async function verifyServiceOwnership(serviceId: string, userId: string) {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { userId: true },
  })
  if (!service || service.userId !== userId) {
    throw new Error("Serviço não encontrado.")
  }
}

// ── Schema de validação ───────────────────────────────────────────────────────

const serviceSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres.")
    .max(60, "Nome muito longo."),
  description: z.string().max(200, "Descrição muito longa.").optional(),
  price: z
    .number({ invalid_type_error: "Preço inválido." })
    .min(0, "Preço não pode ser negativo.")
    .max(99999.99, "Preço muito alto."),
  duration: z
    .number({ invalid_type_error: "Duração inválida." })
    .int("Duração deve ser um número inteiro.")
    .min(5, "Duração mínima: 5 minutos.")
    .max(480, "Duração máxima: 8 horas (480 min)."),
})

type ServicePayload = z.infer<typeof serviceSchema>

function parsePayload(formData: FormData): { data: ServicePayload } | { error: string } {
  const raw = {
    name:        formData.get("name"),
    description: formData.get("description") || undefined,
    price:       Number(formData.get("price")),
    duration:    Number(formData.get("duration")),
  }
  const result = serviceSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.errors[0]?.message ?? "Dados inválidos." }
  }
  return { data: result.data }
}

// ── CREATE ────────────────────────────────────────────────────────────────────

export async function createService(formData: FormData) {
  try {
    const userId = await getAuthUserId()
    const parsed = parsePayload(formData)
    if ("error" in parsed) return { error: parsed.error }

    // Evita nomes duplicados por lojista
    const existing = await prisma.service.findFirst({
      where: { userId, name: { equals: parsed.data.name, mode: "insensitive" } },
      select: { id: true },
    })
    if (existing) {
      return { error: "Você já tem um serviço com este nome." }
    }

    await prisma.service.create({
      data: {
        name:        parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        price:       parsed.data.price,
        duration:    parsed.data.duration,
        userId,
      },
    })

    revalidatePath("/dashboard/services")
    return { success: true }
  } catch (err) {
    console.error("[Services] createService:", err)
    return { error: "Erro ao criar serviço. Tente novamente." }
  }
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export async function updateService(serviceId: string, formData: FormData) {
  try {
    const userId = await getAuthUserId()
    await verifyServiceOwnership(serviceId, userId)

    const parsed = parsePayload(formData)
    if ("error" in parsed) return { error: parsed.error }

    // Evita nome duplicado — exclui o próprio serviço da verificação
    const existing = await prisma.service.findFirst({
      where: {
        userId,
        name: { equals: parsed.data.name, mode: "insensitive" },
        NOT: { id: serviceId },
      },
      select: { id: true },
    })
    if (existing) {
      return { error: "Você já tem outro serviço com este nome." }
    }

    await prisma.service.update({
      where: { id: serviceId },
      data: {
        name:        parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        price:       parsed.data.price,
        duration:    parsed.data.duration,
      },
    })

    revalidatePath("/dashboard/services")
    return { success: true }
  } catch (err) {
    console.error("[Services] updateService:", err)
    return { error: "Erro ao atualizar serviço. Tente novamente." }
  }
}

// ── TOGGLE ACTIVE ─────────────────────────────────────────────────────────────

export async function toggleServiceActive(serviceId: string, active: boolean) {
  try {
    const userId = await getAuthUserId()
    await verifyServiceOwnership(serviceId, userId)

    await prisma.service.update({
      where: { id: serviceId },
      data: { active },
    })

    revalidatePath("/dashboard/services")
    return { success: true }
  } catch (err) {
    console.error("[Services] toggleServiceActive:", err)
    return { error: "Erro ao alterar status do serviço." }
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteService(serviceId: string) {
  try {
    const userId = await getAuthUserId()
    await verifyServiceOwnership(serviceId, userId)

    // Impede exclusão de serviços com agendamentos futuros ativos
    const futureAppointments = await prisma.appointment.count({
      where: {
        serviceId,
        startTime: { gte: new Date() },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    })
    if (futureAppointments > 0) {
      return {
        error: `Este serviço tem ${futureAppointments} agendamento(s) futuro(s) ativo(s). Cancele-os antes de excluir.`,
      }
    }

    await prisma.service.delete({ where: { id: serviceId } })

    revalidatePath("/dashboard/services")
    return { success: true }
  } catch (err) {
    console.error("[Services] deleteService:", err)
    return { error: "Erro ao excluir serviço. Tente novamente." }
  }
}
