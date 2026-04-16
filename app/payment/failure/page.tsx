"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { XCircle, Calendar } from "lucide-react"
import { PlanSelector, type PlanId } from "@/components/auth/plan-selector"

export default function PaymentFailurePage() {
  const router  = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handlePlanSubmit(plan: PlanId) {
    setError(null)

    // Trial — vai direto para o dashboard
    if (plan === "TRIAL") {
      router.push("/dashboard")
      return
    }

    // Plano pago — cria nova preferência e redireciona para o checkout
    try {
      const res  = await fetch("/api/payment/create-preference", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ planType: plan }),
      })
      const data = await res.json()

      if (!res.ok || !data.checkoutUrl) {
        setError("Não foi possível iniciar o pagamento. Tente novamente.")
        return
      }

      window.location.href = data.checkoutUrl
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md flex flex-col gap-6">

        {/* Ícone e mensagem */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold text-foreground">Pagamento não concluído</h1>
            <p className="text-sm text-muted-foreground">
              Nenhum valor foi cobrado. Escolha como quer continuar:
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive text-center">
            {error}
          </div>
        )}

        {/* Seleção de plano — reutiliza o mesmo componente do cadastro */}
        <PlanSelector
          submitLabel={(plan) =>
            plan === "TRIAL" ? "Usar 7 dias grátis" : `Tentar novamente — Plano ${plan === "MONTHLY" ? "Mensal" : "Anual"}`
          }
          onSubmit={handlePlanSubmit}
        />

      </div>
    </div>
  )
}
