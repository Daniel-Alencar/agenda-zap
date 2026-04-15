"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Eye, EyeOff, Loader2, CheckCircle, XCircle, MailCheck,
  Check, Zap, Crown, ArrowRight, ArrowLeft, Gift,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { signUp } from "@/lib/actions/auth"

const PLANS = [
  {
    id:       "TRIAL" as const,
    name:     "7 dias grátis",
    price:    "R$ 0",
    period:   "",
    desc:     "Experimente sem compromisso",
    icon:     <Gift className="h-5 w-5" />,
    features: ["Todas as funcionalidades", "WhatsApp conectado", "Agendamentos ilimitados", "Sem cartão de crédito"],
    highlight: false,
    badge:    null,
  },
  {
    id:       "MONTHLY" as const,
    name:     "Mensal",
    price:    "R$ 49",
    period:   "/mês",
    desc:     "Flexibilidade total",
    icon:     <Zap className="h-5 w-5" />,
    features: ["Todas as funcionalidades", "WhatsApp conectado", "Agendamentos ilimitados", "Suporte por e-mail"],
    highlight: false,
    badge:    null,
  },
  {
    id:       "ANNUAL" as const,
    name:     "Anual",
    price:    "R$ 39",
    period:   "/mês",
    desc:     "Economize 20% — R$ 468/ano",
    icon:     <Crown className="h-5 w-5" />,
    features: ["Todas as funcionalidades", "WhatsApp conectado", "Agendamentos ilimitados", "Suporte prioritário"],
    highlight: true,
    badge:    "Melhor valor",
  },
]

export function RegisterForm() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [savedData, setSavedData] = useState<{
    name: string; email: string; username: string; password: string
  } | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<"TRIAL" | "MONTHLY" | "ANNUAL">("TRIAL")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition]    = useTransition()
  const [username, setUsername]         = useState("")
  const [usernameStatus, setUsernameStatus] = useState<"idle"|"checking"|"available"|"taken">("idle")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!username || username.length < 3) { setUsernameStatus("idle"); return }
    setUsernameStatus("checking")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`)
        const data = await res.json()
        setUsernameStatus(data.available ? "available" : "taken")
      } catch { setUsernameStatus("idle") }
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [username])

  function formatUsername(v: string) {
    return v.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9_-]/g, "")
  }

  function handleStep1(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (usernameStatus === "taken")    { setError("Este nome de usuário já está em uso."); return }
    if (usernameStatus === "checking") { setError("Aguarde a verificação do username."); return }
    const fd = new FormData(e.currentTarget)
    setSavedData({
      name:     (fd.get("name")     as string).trim(),
      email:    (fd.get("email")    as string).trim(),
      username: (fd.get("username") as string).trim().toLowerCase(),
      password: fd.get("password") as string,
    })
    setStep(2)
  }

  function handleStep2() {
    if (!savedData) return
    startTransition(async () => {
      // 1. Cria a conta (sempre como TRIAL — o webhook do MP ativa o plano pago)
      const fd = new FormData()
      fd.append("name",     savedData.name)
      fd.append("email",    savedData.email)
      fd.append("username", savedData.username)
      fd.append("password", savedData.password)
      const result = await signUp(fd)
      if (result?.error)   { setError(result.error); setStep(1); return }
      if (result?.success) { setSuccessMessage(result.success); return }
      // result.redirectTo = "/dashboard" significa que a conta foi criada com sessão ativa

      // 2. Plano pago → cria preference no MP e redireciona para checkout
      if (selectedPlan !== "TRIAL") {
        try {
          const res  = await fetch("/api/payment/create-preference", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ planType: selectedPlan }),
          })
          const data = await res.json()
          if (!res.ok || !data.checkoutUrl) {
            router.push("/dashboard") // fallback: usa o trial
            return
          }
          window.location.href = data.checkoutUrl
          return
        } catch {
          router.push("/dashboard")
          return
        }
      }

      router.push("/dashboard")
    })
  }

  if (successMessage) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="h-7 w-7 text-primary" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold text-foreground">Confirme seu e-mail</p>
          <p className="text-sm text-muted-foreground">{successMessage}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Após confirmar, volte aqui e{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">faça login</Link>.
        </p>
      </div>
    )
  }

  // ── Step 1: dados da conta ────────────────────────────────────────────────
  if (step === 1) {
    return (
      <form onSubmit={handleStep1} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Nome do negócio ou seu nome</Label>
          <Input id="name" name="name" type="text" placeholder="Ex: Barbearia do João"
            autoComplete="name" required minLength={2}
            defaultValue={savedData?.name}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" placeholder="seu@email.com"
            autoComplete="email" required defaultValue={savedData?.email}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">
            Nome de usuário{" "}
            <span className="text-xs font-normal text-muted-foreground">(sua URL pública)</span>
          </Label>
          <div className="relative">
            <Input id="username" name="username" type="text" placeholder="joaobarber"
              required minLength={3} maxLength={30}
              value={username}
              onChange={(e) => setUsername(formatUsername(e.target.value))}
              className={cn(
                "pr-10",
                usernameStatus === "available" && "border-green-500",
                usernameStatus === "taken"     && "border-destructive",
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {usernameStatus === "checking"  && <Loader2     className="h-4 w-4 animate-spin text-muted-foreground" />}
              {usernameStatus === "available" && <CheckCircle className="h-4 w-4 text-green-500" />}
              {usernameStatus === "taken"     && <XCircle     className="h-4 w-4 text-destructive" />}
            </span>
          </div>
          {username.length >= 3 && (
            <p className="text-xs text-muted-foreground">
              Sua página: <span className="font-medium text-foreground">agendazap.com/{username}/book</span>
            </p>
          )}
          {usernameStatus === "taken" && (
            <p className="text-xs text-destructive">Este nome já está em uso. Escolha outro.</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input id="password" name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password" required minLength={6} className="pr-10"
              defaultValue={savedData?.password}
            />
            <button type="button" tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full gap-2"
          disabled={usernameStatus === "taken" || usernameStatus === "checking"}
        >
          Continuar <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    )
  }

  // ── Step 2: escolha do plano ──────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button onClick={() => { setStep(1); setError(null) }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-sm font-medium text-foreground">Escolha seu plano</p>
          <p className="text-xs text-muted-foreground">Você pode mudar depois a qualquer momento.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {PLANS.map((plan) => (
          <button key={plan.id} type="button" onClick={() => setSelectedPlan(plan.id)}
            className={cn(
              "relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
              selectedPlan === plan.id
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-primary/40",
            )}
          >
            {plan.badge && (
              <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                {plan.badge}
              </span>
            )}
            <div className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              selectedPlan === plan.id ? "border-primary bg-primary" : "border-muted-foreground",
            )}>
              {selectedPlan === plan.id && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
            </div>
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
      </div>



      <Button onClick={handleStep2} disabled={isPending} className="w-full gap-2">
        {isPending
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando conta...</>
          : <>{selectedPlan === "TRIAL" ? "Começar 7 dias grátis" : `Criar conta — Plano ${selectedPlan === "MONTHLY" ? "Mensal" : "Anual"}`} <ArrowRight className="h-4 w-4" /></>
        }
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {selectedPlan === "TRIAL" ? "Sem cartão de crédito. Cancele quando quiser." : "Você pode cancelar a qualquer momento."}
      </p>
    </div>
  )
}
