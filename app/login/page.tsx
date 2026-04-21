// =============================================
// PÁGINA DE LOGIN
// =============================================

import Link from "next/link"
import { Calendar } from "lucide-react"
import { LoginForm } from "@/components/auth/login-form"

interface LoginPageProps {
  searchParams: Promise<{
    redirectTo?: string
    error?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams

  return (
    <div className="flex min-h-screen bg-background">
      {/* Lado esquerdo — formulário */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center gap-2">
            <Link href="/">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <Calendar className="h-6 w-6 text-primary-foreground" />
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-foreground">AgendaZap</h1>
            <p className="text-sm text-muted-foreground">Entre na sua conta</p>
          </div>

          {/* Erro de callback (ex: link expirado) */}
          {params.error === "auth_callback_failed" && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              O link de verificação expirou ou é inválido. Tente novamente.
            </div>
          )}

          <LoginForm redirectTo={params.redirectTo} />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Não tem uma conta?{" "}
            <Link
              href="/register"
              className="font-medium text-primary hover:underline"
            >
              Cadastre-se grátis
            </Link>
          </p>
        </div>
      </div>

      {/* Lado direito — decorativo (visível apenas em telas grandes) */}
      <div className="hidden flex-col items-center justify-center gap-8 bg-primary/5 px-12 lg:flex lg:w-1/2">
        <div className="max-w-md text-center">
          <h2 className="text-3xl font-bold text-foreground">
            Gerencie sua agenda com inteligência
          </h2>
          <p className="mt-4 text-muted-foreground">
            Conecte seu WhatsApp, configure seus serviços e deixe seus clientes
            agendarem sozinhos. Você foca no que importa.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              ✓
            </span>
            Lembretes automáticos por WhatsApp
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              ✓
            </span>
            Dashboard com agendamentos em tempo real
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              ✓
            </span>
            Página de agendamento com seu nome
          </div>
        </div>
      </div>
    </div>
  )
}

export const metadata = {
  title: "Entrar — AgendaZap",
}
