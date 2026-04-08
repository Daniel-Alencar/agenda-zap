"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { createInstance, setInstanceWebhook, getQRCode } from "@/lib/evolution"

async function getAuthUserId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Não autenticado")
  return user.id
}

// ── SETUP ─────────────────────────────────────────────────────────────────────
// Cria ou reutiliza a instância da Evolution API para este lojista.
// O instanceName é derivado do userId para ser único e estável.

export async function setupWhatsApp() {
  try {
    const userId = await getAuthUserId()

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, evolutionInstanceName: true },
    })
    if (!user) return { error: "Usuário não encontrado." }

    // Reutiliza o instanceName existente ou gera um novo
    const instanceName = user.evolutionInstanceName ?? `agendazap_${userId.slice(0, 12)}`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
    const webhookUrl = appUrl ? `${appUrl}/api/webhook/evolution` : undefined

    // Cria a instância já com o webhook configurado.
    // Se já existir (409), configura/atualiza o webhook separadamente.
    const created = await createInstance(instanceName, webhookUrl)

    if (!created.success && webhookUrl) {
      await setInstanceWebhook(instanceName, webhookUrl)
    }

    // Atualiza o banco com o instanceName
    await prisma.user.update({
      where: { id: userId },
      data: {
        evolutionInstanceName: instanceName,
        evolutionConnected: false, // reset — será atualizado pelo webhook
      },
    })

    revalidatePath("/dashboard/whatsapp")
    revalidatePath("/dashboard", "layout")

    return { success: true, instanceName, created: created.success }
  } catch (err) {
    console.error("[WhatsApp] setupWhatsApp:", err)
    return { error: "Erro ao configurar WhatsApp. Tente novamente." }
  }
}

// ── DISCONNECT ────────────────────────────────────────────────────────────────

export async function disconnectWhatsApp() {
  try {
    const userId = await getAuthUserId()

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { evolutionInstanceName: true },
    })
    if (!user?.evolutionInstanceName) return { error: "Nenhuma instância configurada." }

    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL ?? "http://localhost:8081"
    const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY ?? ""

    // Faz logout da instância (desconecta o WhatsApp mas mantém a instância)
    await fetch(
      `${EVOLUTION_API_URL}/instance/logout/${user.evolutionInstanceName}`,
      {
        method: "DELETE",
        headers: { apikey: EVOLUTION_API_KEY },
      }
    ).catch(() => {
      // Ignora erro de rede — atualiza o banco de qualquer forma
    })

    await prisma.user.update({
      where: { id: userId },
      data: { evolutionConnected: false },
    })

    revalidatePath("/dashboard/whatsapp")
    revalidatePath("/dashboard", "layout")

    return { success: true }
  } catch (err) {
    console.error("[WhatsApp] disconnectWhatsApp:", err)
    return { error: "Erro ao desconectar. Tente novamente." }
  }
}
