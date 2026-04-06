"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Clock, Phone, MoreVertical, Loader2,
  CheckCircle, XCircle, CalendarClock, MessageCircle, Star,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  confirmAppointment,
  cancelAppointment,
  completeAppointment,
  sendReminderWhatsApp,
  rescheduleAppointment,
} from "@/lib/actions/appointments"
import { AppointmentStatus } from "@prisma/client"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string
  startTime: Date
  endTime: Date
  status: AppointmentStatus
  notes: string | null
  customer: { name: string; phone: string }
  service: { name: string; duration: number; price: unknown }
  // Campos extras necessários para reagendamento
  serviceId: string
  username: string // username do lojista, passado pelo Server Component
}

interface AppointmentsTableProps {
  appointments: Appointment[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const statusConfig: Record<
  AppointmentStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  CONFIRMED: { label: "Confirmado", variant: "default" },
  PENDING:   { label: "Pendente",   variant: "secondary" },
  CANCELLED: { label: "Cancelado",  variant: "destructive" },
  COMPLETED: { label: "Concluído",  variant: "outline" },
}

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^55/, "")
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  return phone
}

// ── Dialog de Reagendamento ───────────────────────────────────────────────────

interface RescheduleDialogProps {
  appointment: Appointment | null
  onClose: () => void
}

function RescheduleDialog({ appointment, onClose }: RescheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string>("")
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [dayClosed, setDayClosed] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Reseta quando o dialog abre
  useEffect(() => {
    if (!appointment) return
    setSelectedDate(undefined)
    setSelectedTime("")
    setSlots([])
    setSlotsError(null)
    setDayClosed(false)
  }, [appointment])

  // Busca slots quando data muda
  const fetchSlots = useCallback(async (date: Date) => {
    if (!appointment) return
    setSlotsLoading(true)
    setSlotsError(null)
    setDayClosed(false)
    setSlots([])
    setSelectedTime("")

    const dateStr = format(date, "yyyy-MM-dd")
    try {
      const res = await fetch(
        `/api/slots?username=${encodeURIComponent(appointment.username)}&serviceId=${encodeURIComponent(appointment.serviceId)}&date=${dateStr}&excludeId=${encodeURIComponent(appointment.id)}`
      )
      const data = await res.json()
      if (!res.ok) { setSlotsError(data.error ?? "Erro ao buscar horários."); return }
      if (data.closed) { setDayClosed(true); return }
      setSlots(data.slots ?? [])
      if ((data.slots ?? []).length === 0) setSlotsError("Sem horários disponíveis nesta data.")
    } catch {
      setSlotsError("Erro de conexão. Tente novamente.")
    } finally {
      setSlotsLoading(false)
    }
  }, [appointment])

  useEffect(() => {
    if (selectedDate) fetchSlots(selectedDate)
  }, [selectedDate, fetchSlots])

  function handleConfirm() {
    if (!appointment || !selectedDate || !selectedTime) return
    startTransition(async () => {
      const result = await rescheduleAppointment(
        appointment.id,
        format(selectedDate, "yyyy-MM-dd"),
        selectedTime
      )
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Agendamento remarcado! O cliente foi notificado.")
        onClose()
      }
    })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <Dialog open={!!appointment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-muted-foreground" />
            Remarcar agendamento
          </DialogTitle>
          <DialogDescription>
            {appointment
              ? `${appointment.customer.name} — ${appointment.service.name}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Calendário */}
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-foreground">Nova data</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarClock className="mr-2 h-4 w-4" />
                  {selectedDate
                    ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : "Selecione uma data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  disabled={(d) => d < today}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Slots */}
          {selectedDate && (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-foreground">Novo horário</p>

              {slotsLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando disponibilidade…
                </div>
              )}

              {!slotsLoading && dayClosed && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Fechado neste dia.
                </div>
              )}

              {!slotsLoading && slotsError && !dayClosed && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {slotsError}
                </div>
              )}

              {!slotsLoading && !dayClosed && slots.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-sm transition-colors",
                        selectedTime === slot
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedDate || !selectedTime || isPending}
          >
            {isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Remarcando…</>
              : "Confirmar remarcação"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Linha individual ──────────────────────────────────────────────────────────

function AppointmentRow({
  appointment,
  onReschedule,
  onCancelRequest,
}: {
  appointment: Appointment
  onReschedule: (a: Appointment) => void
  onCancelRequest: (a: Appointment) => void
}) {
  const [isPending, startTransition] = useTransition()

  const canConfirm  = appointment.status === AppointmentStatus.PENDING
  const canComplete = appointment.status === AppointmentStatus.CONFIRMED
  const canCancel   =
    appointment.status === AppointmentStatus.PENDING ||
    appointment.status === AppointmentStatus.CONFIRMED
  const canReschedule = canCancel
  const canRemind   = canCancel

  function runAction(
    action: () => Promise<{ success?: boolean; error?: string }>,
    successMsg: string
  ) {
    startTransition(async () => {
      const result = await action()
      if (result?.error) toast.error(result.error)
      else toast.success(successMsg)
    })
  }

  const status = statusConfig[appointment.status]

  return (
    <TableRow className={isPending ? "opacity-50 pointer-events-none" : undefined}>
      <TableCell>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {format(new Date(appointment.startTime), "HH:mm")}
          </span>
        </div>
      </TableCell>

      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{appointment.customer.name}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            {formatPhone(appointment.customer.phone)}
          </span>
        </div>
      </TableCell>

      <TableCell className="hidden md:table-cell">
        {appointment.service.name}
      </TableCell>

      <TableCell className="hidden lg:table-cell text-muted-foreground">
        {appointment.service.duration} min
      </TableCell>

      <TableCell className="hidden sm:table-cell font-medium">
        {Number(appointment.service.price).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}
      </TableCell>

      <TableCell>
        <Badge variant={status.variant}>{status.label}</Badge>
      </TableCell>

      <TableCell>
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Ações</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">

              {canConfirm && (
                <DropdownMenuItem
                  onClick={() =>
                    runAction(
                      () => confirmAppointment(appointment.id),
                      "Agendamento confirmado! Cliente notificado."
                    )
                  }
                >
                  <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                  Confirmar
                </DropdownMenuItem>
              )}

              {canComplete && (
                <DropdownMenuItem
                  onClick={() =>
                    runAction(
                      () => completeAppointment(appointment.id),
                      "Agendamento concluído!"
                    )
                  }
                >
                  <Star className="mr-2 h-4 w-4 text-amber-500" />
                  Marcar como concluído
                </DropdownMenuItem>
              )}

              {canReschedule && (
                <DropdownMenuItem onClick={() => onReschedule(appointment)}>
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Remarcar
                </DropdownMenuItem>
              )}

              {canRemind && (
                <DropdownMenuItem
                  onClick={() =>
                    runAction(
                      () => sendReminderWhatsApp(appointment.id),
                      "Lembrete enviado no WhatsApp!"
                    )
                  }
                >
                  <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
                  Enviar lembrete
                </DropdownMenuItem>
              )}

              {canCancel && <DropdownMenuSeparator />}

              {canCancel && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onCancelRequest(appointment)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancelar agendamento
                </DropdownMenuItem>
              )}

            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function AppointmentsTable({ appointments }: AppointmentsTableProps) {
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null)
  const [cancelTarget, setCancelTarget]         = useState<Appointment | null>(null)
  const [isCancelling, startCancelTransition]   = useTransition()

  function handleCancelConfirm() {
    if (!cancelTarget) return
    startCancelTransition(async () => {
      const result = await cancelAppointment(cancelTarget.id)
      if (result.error) toast.error(result.error)
      else toast.success("Agendamento cancelado. Cliente notificado.")
      setCancelTarget(null)
    })
  }

  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Clock className="h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium text-muted-foreground">Nenhum agendamento para hoje</p>
        <p className="text-sm text-muted-foreground">
          Quando clientes agendarem, eles aparecerão aqui.
        </p>
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Horário</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="hidden md:table-cell">Serviço</TableHead>
            <TableHead className="hidden lg:table-cell">Duração</TableHead>
            <TableHead className="hidden sm:table-cell">Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((a) => (
            <AppointmentRow
              key={a.id}
              appointment={a}
              onReschedule={setRescheduleTarget}
              onCancelRequest={setCancelTarget}
            />
          ))}
        </TableBody>
      </Table>

      {/* Dialog de reagendamento */}
      <RescheduleDialog
        appointment={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
      />

      {/* Confirmação de cancelamento */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O agendamento de <strong>{cancelTarget?.customer.name}</strong> (
              {cancelTarget?.service.name} às{" "}
              {cancelTarget && format(new Date(cancelTarget.startTime), "HH:mm")})
              será cancelado e o cliente receberá uma notificação no WhatsApp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              disabled={isCancelling}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isCancelling
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelando…</>
                : "Confirmar cancelamento"
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
