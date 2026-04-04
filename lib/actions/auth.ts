// =============================================
// SERVER ACTIONS DE AUTENTICAÇÃO
// =============================================
// Funções de servidor para login, cadastro, logout e recuperação de senha.
// Usadas nos formulários de autenticação via "use server".

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

  // Valida se o username já existe no banco
  const existingUser = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  })

  if (existingUser) {
    return { error: "Este nome de usuário já está em uso. Escolha outro." }
  }

  // Cria o usuário no Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        username: username.toLowerCase(),
      },
    },
  })

  if (error) {
    if (error.message.includes("already registered")) {
      return { error: "Este e-mail já está cadastrado. Faça login ou recupere sua senha." }
    }
    return { error: error.message }
  }

  // Cria o usuário no banco de dados (Prisma) vinculado ao ID do Supabase
  if (data.user) {
    await prisma.user.create({
      data: {
        id: data.user.id, // usa o UUID do Supabase como ID
        email,
        name,
        username: username.toLowerCase(),
        password: "", // Supabase gerencia a senha — campo mantido por compatibilidade de schema
      },
    })
  }

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

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return { error: "E-mail ou senha incorretos. Tente novamente." }
    }
    if (error.message.includes("Email not confirmed")) {
      return { error: "Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada." }
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

  if (error) {
    return { error: error.message }
  }

  return { success: "E-mail de recuperação enviado. Verifique sua caixa de entrada." }
}

// =============================================
// REDEFINIÇÃO DE SENHA
// =============================================
export async function resetPassword(formData: FormData) {
  const supabase = await createClient()

  const password = formData.get("password") as string

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  redirect("/dashboard")
}

// =============================================
// BUSCAR USUÁRIO ATUAL DO BANCO
// =============================================
export async function getCurrentUser() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  return prisma.user.findUnique({
    where: { id: user.id },
  })
}
