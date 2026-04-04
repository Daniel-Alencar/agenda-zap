// =============================================
// PÁGINA DE RECUPERAÇÃO DE SENHA
// =============================================

import Link from "next/link"
import { Calendar } from "lucide-react"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export default function ForgotPasswordPage() {
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
            Recuperar senha
          </p>
        </div>

        <ForgotPasswordForm />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Lembrou a senha?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  )
}

export const metadata = {
  title: "Recuperar senha — AgendaZap",
}
