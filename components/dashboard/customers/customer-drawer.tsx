"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Phone, Mail, Calendar, Clock, DollarSign,
  MessageCircle, Loader2, User,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { AppointmentStatus } from "@prisma/client"
import type { CustomerDetail } from "@/lib/data/customers"

// ── helpers ───────────────────────────────────────────────────────────────────

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^55/, "")
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return phone
}

function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "")
  const number = digits.startsWith("55") ? digits : `55${digits}`
  return `https://wa.me/${number}`
}

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  CONFIRMED: { label: "Confirmado", variant: "default"     },
  PENDING:   { label: "Pendente",   variant: "secondary"   },
  CANCELLED: { label: "Cancelado",  variant: "destructive" },
  COMPLETED: { label: "Concluído",  variant: "outline"     },
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function DrawerSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-1">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface CustomerDrawerProps {
  customerId: string | null
  onClose: () => void
}

export function CustomerDrawer({ customerId, onClose }: CustomerDrawerProps) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!customerId) {
      setCustomer(null)
      return
    }

    setLoading(true)
    setError(null)

    fetch(`/api/customers/${customerId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Não foi possível carregar os dados do cliente.")
        return r.json()
      })
      .then((data) => setCustomer(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [customerId])

  // Métricas calculadas
  const totalSpent = customer?.appointments
    .filter((a) => a.status === AppointmentStatus.COMPLETED)
    .reduce((sum, a) => sum + Number(a.service.price), 0) ?? 0

  const completedCount = customer?.appointments
    .filter((a) => a.status === AppointmentStatus.COMPLETED).length ?? 0

  const lastVisit = customer?.appointments.find(
    (a) => a.status === AppointmentStatus.COMPLETED
  )

  const upcoming = customer?.appointments.filter(
    (a) =>
      (a.status === AppointmentStatus.PENDING || a.status === AppointmentStatus.CONFIRMED) &&
      new Date(a.startTime) >= new Date()
  ) ?? []

  const past = customer?.appointments.filter(
    (a) =>
      a.status === AppointmentStatus.COMPLETED ||
      a.status === AppointmentStatus.CANCELLED ||
      new Date(a.startTime) < new Date()
  ) ?? []

  return (
    <Sheet open={!!customerId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            {loading ? "Carregando…" : (customer?.name ?? "Cliente")}
          </SheetTitle>
          {customer && (
            <SheetDescription>
              Cliente desde {format(new Date(customer.createdAt), "MMMM 'de' yyyy", { locale: ptBR })}
            </SheetDescription>
          )}
        </SheetHeader>

        {loading && <DrawerSkeleton />}

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {customer && !loading && (
          <div className="flex flex-col gap-5 pb-8">

            {/* Contato */}
            <div className="flex flex-col gap-2">
              <a
                href={whatsappLink(customer.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                {formatPhone(customer.phone)}
                <MessageCircle className="ml-auto h-4 w-4 text-green-600" />
              </a>
              {customer.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  {customer.email}
                </div>
              )}
            </div>

            <Separator />

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center rounded-lg border border-border bg-muted/30 p-3 text-center">
                <span className="text-xl font-bold text-foreground">
                  {customer.appointments.length}
                </span>
                <span className="text-xs text-muted-foreground">Agendamentos</span>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-border bg-muted/30 p-3 text-center">
                <span className="text-xl font-bold text-foreground">{completedCount}</span>
                <span className="text-xs text-muted-foreground">Concluídos</span>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-border bg-muted/30 p-3 text-center">
                <span className="text-base font-bold text-foreground">
                  {totalSpent.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
                <span className="text-xs text-muted-foreground">Total gasto</span>
              </div>
            </div>

            {lastVisit && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                Última visita:{" "}
                <span className="text-foreground">
                  {format(new Date(lastVisit.startTime), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            )}

            <Separator />

            {/* Próximos agendamentos */}
            {upcoming.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Próximos
                </p>
                {upcoming.map((a) => (
                  <AppointmentCard key={a.id} appointment={a} />
                ))}
              </div>
            )}

            {/* Histórico */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Histórico {past.length > 0 && `(${past.length})`}
              </p>
              {past.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Sem histórico ainda.</p>
              ) : (
                past.map((a) => <AppointmentCard key={a.id} appointment={a} />)
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Card de agendamento individual ────────────────────────────────────────────

function AppointmentCard({
  appointment,
}: {
  appointment: CustomerDetail["appointments"][number]
}) {
  const config = STATUS_CONFIG[appointment.status]
  const start  = new Date(appointment.startTime)

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm text-foreground leading-tight">
          {appointment.service.name}
        </span>
        <Badge variant={config.variant} className="shrink-0 text-xs">
          {config.label}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {format(start, "dd/MM/yyyy", { locale: ptBR })}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(start, "HH:mm")}
          {" · "}
          {appointment.service.duration} min
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          {Number(appointment.service.price).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
        </span>
      </div>

      {appointment.notes && (
        <p className="text-xs text-muted-foreground italic border-t border-border pt-1.5 mt-0.5">
          "{appointment.notes}"
        </p>
      )}
    </div>
  )
}
