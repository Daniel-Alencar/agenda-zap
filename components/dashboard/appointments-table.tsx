// =============================================
// TABELA DE AGENDAMENTOS DO DIA
// =============================================
// Client Component para permitir interações (confirmar, cancelar, etc.)
// Recebe os dados já buscados pelo Server Component pai.

"use client"

import { useTransition } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Clock, Phone, MoreVertical, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  confirmAppointment,
  cancelAppointment,
  completeAppointment,
} from "@/lib/actions/appointments"
import { AppointmentStatus } from "@prisma/client"
import { toast } from "sonner"

// Tipo derivado da query Prisma (passado pelo Server Component)
interface Appointment {
  id: string
  startTime: Date
  endTime: Date
  status: AppointmentStatus
  notes: string | null
  customer: { name: string; phone: string }
  service: { name: string; duration: number; price: unknown }
}

interface AppointmentsTableProps {
  appointments: Appointment[]
}

const statusConfig: Record<
  AppointmentStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  CONFIRMED: { label: "Confirmado", variant: "default" },
  PENDING: { label: "Pendente", variant: "secondary" },
  CANCELLED: { label: "Cancelado", variant: "destructive" },
  COMPLETED: { label: "Concluído", variant: "outline" },
}

function formatPhone(phone: string) {
  // Formata 5511999999999 → (11) 99999-9999
  const digits = phone.replace(/\D/g, "").replace(/^55/, "")
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  return phone
}

function AppointmentRow({ appointment }: { appointment: Appointment }) {
  const [isPending, startTransition] = useTransition()
  const status = statusConfig[appointment.status]
  const canConfirm = appointment.status === AppointmentStatus.PENDING
  const canComplete = appointment.status === AppointmentStatus.CONFIRMED
  const canCancel =
    appointment.status === AppointmentStatus.PENDING ||
    appointment.status === AppointmentStatus.CONFIRMED

  function runAction(action: () => Promise<{ success?: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action()
      if (result.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <TableRow className={isPending ? "opacity-50" : undefined}>
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
          <span className="font-medium">{appointment.customer.name}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            {formatPhone(appointment.customer.phone)}
          </span>
        </div>
      </TableCell>

      <TableCell className="hidden md:table-cell">
        {appointment.service.name}
      </TableCell>

      <TableCell className="hidden lg:table-cell">
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
            <DropdownMenuContent align="end">
              {canConfirm && (
                <DropdownMenuItem
                  onClick={() =>
                    runAction(() => confirmAppointment(appointment.id))
                  }
                >
                  Confirmar
                </DropdownMenuItem>
              )}
              {canComplete && (
                <DropdownMenuItem
                  onClick={() =>
                    runAction(() => completeAppointment(appointment.id))
                  }
                >
                  Marcar como concluído
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => {
                  const whatsapp = `https://wa.me/${appointment.customer.phone}`
                  window.open(whatsapp, "_blank")
                }}
              >
                Enviar lembrete
              </DropdownMenuItem>
              {canCancel && <DropdownMenuSeparator />}
              {canCancel && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() =>
                    runAction(() => cancelAppointment(appointment.id))
                  }
                >
                  Cancelar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  )
}

export function AppointmentsTable({ appointments }: AppointmentsTableProps) {
  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Clock className="h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium text-muted-foreground">
          Nenhum agendamento para hoje
        </p>
        <p className="text-sm text-muted-foreground">
          Quando clientes agendarem, eles aparecerão aqui.
        </p>
      </div>
    )
  }

  return (
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
        {appointments.map((appointment) => (
          <AppointmentRow key={appointment.id} appointment={appointment} />
        ))}
      </TableBody>
    </Table>
  )
}
