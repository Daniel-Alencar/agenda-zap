"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Calendar, LogOut, ArrowLeft, Sparkles } from "lucide-react"
import { PlanSelector, type PlanId } from "@/components/auth/plan-selector"
import { signOut } from "@/lib/actions/auth"
import Link from "next/link"

export default function PricingPage() {
  const router  = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handlePlanSubmit(plan: PlanId) {
    setError(null)

    // Trial — volta ao dashboard
    if (plan === "TRIAL") {
      router.push("/dashboard")
      return
    }

    // Plano pago — cria preference no Mercado Pago e redireciona para o checkout
    try {
      const res  = await fetch("/api/payment/create-preference", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ planType: plan }),
      })
      const data = await res.json()

      if (!res.ok || !data.checkoutUrl) {
        setError(data.error ?? "Não foi possível iniciar o pagamento. Tente novamente.")
        return
      }

      window.location.href = data.checkoutUrl
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.")
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md flex flex-col gap-8">

        {/* Topo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Calendar className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Escolha seu plano</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Assine para continuar usando todos os recursos do AgendaZap.
            </p>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive text-center">
            {error}
          </div>
        )}

        {/* Seletor de planos com botão de confirmação */}
        <PlanSelector
          submitLabel={(plan) =>
            plan === "TRIAL"
              ? "Continuar com trial gratuito"
              : `Assinar plano ${plan === "MONTHLY" ? "Mensal" : "Anual"}`
          }
          onSubmit={handlePlanSubmit}
        />

        {/* Voltar ao dashboard e Sair */}
        <div className="flex flex-col items-center gap-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Voltar ao dashboard
          </Link>

          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Sair da conta
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
