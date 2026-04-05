"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

// =============================================
// CADASTRO
// =============================================
export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const username = formData.get("username") as string

  const existingUser = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  })

  if (existingUser) {
    return { error: "Este nome de usuário já está em uso. Escolha outro." }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, username: username.toLowerCase() },
    },
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

  // Cria o registro no Prisma — upsert para evitar falha se já existir por alguma razão
  await prisma.user.upsert({
    where: { id: data.user.id },
    update: { name, username: username.toLowerCase(), email },
    create: {
      id: data.user.id,
      email,
      name,
      username: username.toLowerCase(),
      password: "",
    },
  })

  // Quando confirmação de e-mail está ATIVA no Supabase:
  // data.session === null e data.user.identities pode estar vazio.
  // Nesse caso não há sessão — informamos o usuário em vez de redirecionar pro dashboard.
  if (!data.session) {
    return {
      success:
        "Conta criada! Verifique seu e-mail e clique no link de confirmação para acessar o sistema.",
    }
  }

  // Confirmação desativada (desenvolvimento) — redireciona direto
  revalidatePath("/", "layout")
  redirect("/dashboard")
}

// =============================================
// LOGIN
// =============================================
export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const redirectTo = formData.get("redirectTo") as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return { error: "E-mail ou senha incorretos. Tente novamente." }
    }
    if (error.message.includes("Email not confirmed")) {
      return {
        error:
          "E-mail ainda não confirmado. Verifique sua caixa de entrada (e o spam). Reenviamos o link de confirmação.",
      }
    }
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  redirect(redirectTo || "/dashboard")
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
  const email = formData.get("email") as string

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
  const email = formData.get("email") as string

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  })

  if (error) return { error: error.message }

  return { success: "E-mail de confirmação reenviado. Verifique sua caixa de entrada." }
}
