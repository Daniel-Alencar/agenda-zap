// =============================================
// PÁGINA DE REDEFINIÇÃO DE SENHA
// =============================================
// Acessada após clicar no link do e-mail de recuperação.

import { Calendar } from "lucide-react"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export default function ResetPasswordPage() {
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
            Criar nova senha
          </p>
        </div>

        <ResetPasswordForm />
      </div>
    </div>
  )
}

export const metadata = {
  title: "Nova senha — AgendaZap",
}
