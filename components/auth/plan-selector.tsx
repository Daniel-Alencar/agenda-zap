"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Zap, Crown, Gift, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── Configuração dos planos ───────────────────────────────────────────────────

export const PLANS = [
  {
    id:        "TRIAL" as const,
    name:      "7 dias grátis",
    price:     "R$ 0",
    period:    "",
    desc:      "Experimente sem compromisso",
    icon:      <Gift className="h-5 w-5" />,
    features:  ["Todas as funcionalidades", "WhatsApp conectado", "Agendamentos ilimitados", "Sem cartão de crédito"],
    highlight: false,
    badge:     null,
  },
  {
    id:        "MONTHLY" as const,
    name:      "Mensal",
    price:     "R$ 29",
    period:    "/mês",
    desc:      "Flexibilidade total",
    icon:      <Zap className="h-5 w-5" />,
    features:  ["Todas as funcionalidades", "WhatsApp conectado", "Agendamentos ilimitados", "Suporte por e-mail"],
    highlight: false,
    badge:     null,
  },
  {
    id:        "ANNUAL" as const,
    name:      "Anual",
    price:     "R$ 25",
    period:    "/mês",
    desc:      "Economize 20% — R$ 468/ano",
    icon:      <Crown className="h-5 w-5" />,
    features:  ["Todas as funcionalidades", "WhatsApp conectado", "Agendamentos ilimitados", "Suporte prioritário"],
    highlight: true,
    badge:     "Melhor valor",
  },
]

export type PlanId = "TRIAL" | "MONTHLY" | "ANNUAL"

// ── Props ─────────────────────────────────────────────────────────────────────

interface PlanSelectorProps {
  /** Label do botão de confirmação */
  submitLabel?: (plan: PlanId) => string
  /** Chamado quando o usuário confirma o plano escolhido */
  onSubmit: (plan: PlanId) => Promise<void>
  /** Estado de carregamento externo (opcional) */
  isPending?: boolean
}

// ── Componente ────────────────────────────────────────────────────────────────

export function PlanSelector({ submitLabel, onSubmit, isPending: externalPending }: PlanSelectorProps) {
  const [selected, setSelected]   = useState<PlanId>("TRIAL")
  const [isPending, startTransition] = useTransition()

  const loading = externalPending ?? isPending

  const defaultLabel = (plan: PlanId) =>
    plan === "TRIAL"
      ? "Começar 7 dias grátis"
      : `Assinar plano ${plan === "MONTHLY" ? "Mensal" : "Anual"}`

  function handleClick() {
    startTransition(async () => {
      await onSubmit(selected)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {PLANS.map((plan) => (
        <button
          key={plan.id}
          type="button"
          onClick={() => setSelected(plan.id)}
          className={cn(
            "relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
            selected === plan.id
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border hover:border-primary/40"
          )}
        >
          {plan.badge && (
            <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              {plan.badge}
            </span>
          )}

          {/* Radio */}
          <div className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            selected === plan.id ? "border-primary bg-primary" : "border-muted-foreground"
          )}>
            {selected === plan.id && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
          </div>

          {/* Conteúdo */}
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                {plan.icon} {plan.name}
              </span>
              <span className="text-sm font-bold text-foreground">
                {plan.price}
                {plan.period && <span className="text-xs font-normal text-muted-foreground">{plan.period}</span>}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{plan.desc}</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Check className="h-3 w-3 shrink-0 text-primary" /> {f}
                </li>
              ))}
            </ul>
          </div>
        </button>
      ))}

      <Button onClick={handleClick} disabled={loading} className="w-full gap-2">
        {loading
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
          : <>{(submitLabel ?? defaultLabel)(selected)} <ArrowRight className="h-4 w-4" /></>
        }
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {selected === "TRIAL"
          ? "Sem cartão de crédito. Cancele quando quiser."
          : "Você pode cancelar a qualquer momento."}
      </p>
    </div>
  )
}
