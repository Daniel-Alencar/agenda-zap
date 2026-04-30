"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

async function getAuthUserId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Não autenticado")
  return user.id
}

// ── CANCELAR PLANO ────────────────────────────────────────────────────────────
// Marca planCancelledAt com a data atual. O plano continua funcionando até
// planExpiresAt — depois disso o cron marca como EXPIRED normalmente.

export async function cancelPlan() {
  try {
    const userId = await getAuthUserId()

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { planStatus: true, planExpiresAt: true },
    })

    if (!user) return { error: "Usuário não encontrado." }

    if (user.planStatus !== "ACTIVE") {
      return { error: "Apenas planos ativos podem ser cancelados." }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { planCancelledAt: new Date() },
    })

    revalidatePath("/dashboard", "layout")
    revalidatePath("/dashboard/subscription")

    return { success: true }
  } catch (err) {
    console.error("[Subscription] cancelPlan:", err)
    return { error: "Erro ao cancelar plano. Tente novamente." }
  }
}

// ── REATIVAR PLANO ────────────────────────────────────────────────────────────
// Remove o planCancelledAt — o plano volta ao normal e continua até expirar.
// Se expirar, o usuário precisará pagar novamente.

export async function reactivatePlan() {
  try {
    const userId = await getAuthUserId()

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { planStatus: true, planCancelledAt: true },
    })

    if (!user) return { error: "Usuário não encontrado." }

    if (user.planStatus !== "ACTIVE" || !user.planCancelledAt) {
      return { error: "Nenhum cancelamento pendente para reverter." }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { planCancelledAt: null },
    })

    revalidatePath("/dashboard", "layout")
    revalidatePath("/dashboard/subscription")

    return { success: true }
  } catch (err) {
    console.error("[Subscription] reactivatePlan:", err)
    return { error: "Erro ao reativar plano. Tente novamente." }
  }
}
