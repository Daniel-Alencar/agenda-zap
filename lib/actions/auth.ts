"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

// ── helpers ───────────────────────────────────────────────────────────────────

/** Valida que redirectTo é um path interno seguro e não uma string "null"/"undefined". */
function safeRedirectTo(value: string | null): string {
  if (!value || value === "null" || value === "undefined") return "/dashboard"
  if (!value.startsWith("/")) return "/dashboard"
  return value
}

// =============================================
// CADASTRO
// =============================================
export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const name     = (formData.get("name")     as string)?.trim()
  const email    = (formData.get("email")    as string)?.trim()
  const password = (formData.get("password") as string)
  const username = (formData.get("username") as string)?.trim().toLowerCase()
  const plan     = (formData.get("plan")     as string | null) // "MONTHLY" | "ANNUAL" | null

  if (!name || !email || !password || !username) {
    return { error: "Preencha todos os campos obrigatórios." }
  }

  const existingUser = await prisma.user.findUnique({ where: { username } })
  if (existingUser) {
    return { error: "Este nome de usuário já está em uso. Escolha outro." }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, username } },
  })

  if (error) {
    if (error.message.includes("already registered")) {
      return { error: "Este e-mail já está cadastrado. Faça login ou recupere sua senha." }
    }
    return { error: error.message }
  }

  if (!data.user) {
    return { error: "Não foi possível criar a conta. Tente novamente." }
  }

  const now          = new Date()
  const trialEndsAt  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // +7 dias

  // Se o usuário já escolheu um plano no cadastro, marca como ACTIVE
  // com prazo baseado no plano (30 ou 365 dias a partir de hoje).
  // Na prática, o lojista deve ativar manualmente após confirmar o pagamento.
  // Este campo apenas registra a INTENÇÃO — a ativação real vem do admin.
  const planType     = plan === "MONTHLY" || plan === "ANNUAL" ? plan : null
  const planStatus   = "TRIAL" as const  // sempre começa como TRIAL; admin ativa depois

  await prisma.user.upsert({
    where: { id: data.user.id },
    update: { name, username, email },
    create: {
      id: data.user.id,
      email,
      name,
      username,
      password:     "",
      planStatus,
      planType,
      trialEndsAt,
    },
  })

  if (!data.session) {
    return {
      success: "Conta criada! Verifique seu e-mail e clique no link de confirmação para acessar.",
    }
  }

  revalidatePath("/", "layout")
  redirect("/dashboard")
}

// =============================================
// LOGIN
// =============================================
export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email      = (formData.get("email")      as string)?.trim()
  const password   = (formData.get("password")   as string)
  const redirectTo = safeRedirectTo(formData.get("redirectTo") as string | null)

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return { error: "E-mail ou senha incorretos. Tente novamente." }
    }
    if (error.message.includes("Email not confirmed")) {
      return { error: "E-mail ainda não confirmado. Verifique sua caixa de entrada (incluindo spam)." }
    }
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  // Retorna o destino para o cliente navegar — não usa redirect() no servidor
  // para evitar que seja engolido pelo useTransition do formulário.
  return { redirectTo }
}

// =============================================
// LOGOUT
// =============================================
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}

// =============================================
// RECUPERAÇÃO DE SENHA
// =============================================
export async function forgotPassword(formData: FormData) {
  const supabase = await createClient()
  const email = (formData.get("email") as string)?.trim()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  })

  if (error) return { error: error.message }
  return { success: "E-mail de recuperação enviado. Verifique sua caixa de entrada." }
}

// =============================================
// REDEFINIÇÃO DE SENHA
// =============================================
export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get("password") as string

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  revalidatePath("/", "layout")
  redirect("/dashboard")
}

// =============================================
// REENVIAR E-MAIL DE CONFIRMAÇÃO
// =============================================
export async function resendConfirmationEmail(formData: FormData) {
  const supabase = await createClient()
  const email = (formData.get("email") as string)?.trim()

  const { error } = await supabase.auth.resend({ type: "signup", email })
  if (error) return { error: error.message }
  return { success: "E-mail de confirmação reenviado. Verifique sua caixa de entrada." }
}
