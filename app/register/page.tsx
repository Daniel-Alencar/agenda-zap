// =============================================
// PÁGINA DE CADASTRO
// =============================================

import Link from "next/link"
import { Calendar } from "lucide-react"
import { RegisterForm } from "@/components/auth/register-form"

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Calendar className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">AgendaZap</h1>
          <p className="text-sm text-muted-foreground">
            Crie sua conta grátis
          </p>
        </div>

        <RegisterForm />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem uma conta?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Faça login
          </Link>
        </p>
      </div>
    </div>
  )
}

export const metadata = {
  title: "Criar conta — AgendaZap",
}
