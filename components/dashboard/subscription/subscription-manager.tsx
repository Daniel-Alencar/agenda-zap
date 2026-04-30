"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CreditCard, Calendar, AlertTriangle, CheckCircle,
  XCircle, Loader2, RotateCcw, Sparkles, Clock, Ban,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cancelPlan, reactivatePlan } from "@/lib/actions/subscription"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface SubscriptionData {
  planStatus:      "TRIAL" | "ACTIVE" | "EXPIRED"
  planType:        "MONTHLY" | "ANNUAL" | null
  trialEndsAt:     string
  planExpiresAt:   string | null
  planCancelledAt: string | null
}

interface SubscriptionManagerProps {
  subscription: SubscriptionData
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return format(new Date(dateStr), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

function daysUntil(dateStr: string): number {
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000))
}

function planLabel(planType: "MONTHLY" | "ANNUAL" | null): string {
  if (planType === "MONTHLY") return "Mensal"
  if (planType === "ANNUAL") return "Anual"
  return "—"
}

function planPrice(planType: "MONTHLY" | "ANNUAL" | null): string {
  if (planType === "MONTHLY") return "R$ 29,00/mês"
  if (planType === "ANNUAL") return "R$ 25,00/mês (R$ 300,00/ano)"
  return "—"
}

// ── Componente ────────────────────────────────────────────────────────────────

export function SubscriptionManager({ subscription }: SubscriptionManagerProps) {
  const router = useRouter()
  const [isCancelPending, startCancelTransition] = useTransition()
  const [isReactivatePending, startReactivateTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { planStatus, planType, trialEndsAt, planExpiresAt, planCancelledAt } = subscription

  const isCancelled = !!planCancelledAt
  const isActive    = planStatus === "ACTIVE"
  const isTrial     = planStatus === "TRIAL"
  const isExpired   = planStatus === "EXPIRED"

  const expiryDate = isActive && planExpiresAt ? planExpiresAt : isTrial ? trialEndsAt : null
  const daysLeft   = expiryDate ? daysUntil(expiryDate) : 0

  function handleCancel() {
    startCancelTransition(async () => {
      const result = await cancelPlan()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Plano cancelado. Seu acesso continua até o fim do período.")
        setDialogOpen(false)
        router.refresh()
      }
    })
  }

  function handleReactivate() {
    startReactivateTransition(async () => {
      const result = await reactivatePlan()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Plano reativado com sucesso!")
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assinatura</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie seu plano e assinatura do AgendaZap.
        </p>
      </div>

      {/* Card principal do plano */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Seu Plano
            </CardTitle>
            <StatusBadge
              planStatus={planStatus}
              isCancelled={isCancelled}
            />
          </div>
          <CardDescription>
            {isTrial && "Você está no período de teste gratuito."}
            {isActive && !isCancelled && "Seu plano está ativo e funcionando."}
            {isActive && isCancelled && "Seu plano foi cancelado mas continua ativo até o fim do período."}
            {isExpired && "Seu plano expirou. Renove para continuar usando o AgendaZap."}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">

          {/* Detalhes do plano */}
          {(isActive || (isTrial && daysLeft > 0)) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isActive && (
                <DetailItem
                  icon={<Sparkles className="h-4 w-4 text-primary" />}
                  label="Plano"
                  value={planLabel(planType)}
                />
              )}
              {isActive && (
                <DetailItem
                  icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
                  label="Valor"
                  value={planPrice(planType)}
                />
              )}
              {expiryDate && (
                <DetailItem
                  icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
                  label={isTrial ? "Trial expira em" : "Acesso até"}
                  value={formatDate(expiryDate)}
                />
              )}
              {expiryDate && (
                <DetailItem
                  icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                  label="Dias restantes"
                  value={`${daysLeft} dia${daysLeft !== 1 ? "s" : ""}`}
                />
              )}
            </div>
          )}

          {/* Data de cancelamento */}
          {isCancelled && planCancelledAt && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">
                    Cancelamento agendado
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Você cancelou em {formatDate(planCancelledAt)}.
                    {planExpiresAt && (
                      <> Seu acesso continuará funcionando normalmente até <strong>{formatDate(planExpiresAt)}</strong>. Após essa data, sua conta será limitada.</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-3">

            {/* Plano ativo sem cancelamento → mostrar botão de cancelar */}
            {isActive && !isCancelled && (
              <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <Ban className="h-4 w-4" />
                    Cancelar plano
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar seu plano?</AlertDialogTitle>
                    <AlertDialogDescription className="flex flex-col gap-2">
                      <span>
                        Seu acesso continuará funcionando normalmente até{" "}
                        {planExpiresAt ? (
                          <strong>{formatDate(planExpiresAt)}</strong>
                        ) : (
                          "o fim do período"
                        )}.
                      </span>
                      <span>
                        Após essa data, sua conta será limitada e o WhatsApp será desconectado automaticamente.
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        Você pode reativar o plano a qualquer momento antes da expiração.
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Manter plano</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancel}
                      disabled={isCancelPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
                    >
                      {isCancelPending
                        ? <><Loader2 className="h-4 w-4 animate-spin" />Cancelando…</>
                        : <><Ban className="h-4 w-4" />Sim, cancelar</>
                      }
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Plano ativo com cancelamento → mostrar botão de reativar */}
            {isActive && isCancelled && (
              <Button
                onClick={handleReactivate}
                disabled={isReactivatePending}
                className="gap-2"
              >
                {isReactivatePending
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Reativando…</>
                  : <><RotateCcw className="h-4 w-4" />Reativar plano</>
                }
              </Button>
            )}

            {/* Trial → botão para assinar */}
            {isTrial && (
              <Button
                onClick={() => router.push("/pricing")}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Assinar um plano
              </Button>
            )}

            {/* Expirado → botão para renovar */}
            {isExpired && (
              <Button
                onClick={() => router.push("/pricing")}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Renovar plano
              </Button>
            )}

            {/* Botão para ver planos (sempre visível para ativos) */}
            {isActive && (
              <Button
                variant="outline"
                onClick={() => router.push("/pricing")}
                className="gap-2"
              >
                <CreditCard className="h-4 w-4" />
                Ver planos
              </Button>
            )}

          </div>
        </CardContent>
      </Card>

    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function StatusBadge({ planStatus, isCancelled }: { planStatus: string; isCancelled: boolean }) {
  if (isCancelled && planStatus === "ACTIVE") {
    return (
      <Badge className="gap-1.5 bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/10">
        <AlertTriangle className="h-3 w-3" />
        Cancelamento agendado
      </Badge>
    )
  }

  if (planStatus === "ACTIVE") {
    return (
      <Badge className="gap-1.5 bg-green-500/10 text-green-700 border-green-500/30 hover:bg-green-500/10">
        <CheckCircle className="h-3 w-3" />
        Ativo
      </Badge>
    )
  }

  if (planStatus === "TRIAL") {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <Clock className="h-3 w-3" />
        Trial
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="gap-1.5 text-destructive border-destructive/30">
      <XCircle className="h-3 w-3" />
      Expirado
    </Badge>
  )
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="mt-0.5">{icon}</div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-foreground">{value}</span>
      </div>
    </div>
  )
}
