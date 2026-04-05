// =============================================
// LISTA DE SERVIÇOS (Client Component)
// =============================================
// Recebe os serviços do Server Component pai.
// Gerencia o estado local do Sheet e dispara Server Actions.

"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, MoreVertical, Loader2, Clock, DollarSign } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { toggleServiceActive, deleteService } from "@/lib/actions/services"
import { ServiceFormSheet, type ServiceFormValues } from "./service-form"
import type { ServiceRow } from "@/lib/data/services"

interface ServiceListProps {
  services: ServiceRow[]
}

// Linha individual com seu próprio useTransition para
// o switch não bloquear as outras linhas durante o update
function ServiceCard({
  service,
  onEdit,
  onDeleteRequest,
}: {
  service: ServiceRow
  onEdit: (s: ServiceFormValues) => void
  onDeleteRequest: (s: ServiceRow) => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleToggle(checked: boolean) {
    startTransition(async () => {
      const result = await toggleServiceActive(service.id, checked)
      if (result.error) toast.error(result.error)
    })
  }

  const priceFormatted = Number(service.price).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })

  return (
    <Card className={service.active ? undefined : "opacity-60"}>
      <CardContent className="flex items-start justify-between gap-4 p-4">
        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-foreground">{service.name}</span>
            {!service.active && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                Inativo
              </Badge>
            )}
          </div>
          {service.description && (
            <p className="truncate text-sm text-muted-foreground">{service.description}</p>
          )}
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              {priceFormatted}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {service.duration} min
            </span>
            <span className="text-xs">
              {service._count.appointments} agendamento{service._count.appointments !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Controles */}
        <div className="flex shrink-0 items-center gap-3">
          {/* Toggle ativo/inativo */}
          <div className="flex items-center gap-2">
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Switch
              checked={service.active}
              onCheckedChange={handleToggle}
              disabled={isPending}
              aria-label={service.active ? "Desativar serviço" : "Ativar serviço"}
            />
          </div>

          {/* Menu de ações */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Ações</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  onEdit({
                    id:          service.id,
                    name:        service.name,
                    description: service.description ?? "",
                    price:       Number(service.price),
                    duration:    service.duration,
                  })
                }
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDeleteRequest(service)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}

export function ServiceList({ services }: ServiceListProps) {
  const [sheetOpen, setSheetOpen]   = useState(false)
  const [editService, setEditService] = useState<ServiceFormValues | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServiceRow | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()

  function openCreate() {
    setEditService(null)
    setSheetOpen(true)
  }

  function openEdit(values: ServiceFormValues) {
    setEditService(values)
    setSheetOpen(true)
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    startDeleteTransition(async () => {
      const result = await deleteService(deleteTarget.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Serviço excluído.")
      }
      setDeleteTarget(null)
    })
  }

  const active   = services.filter((s) => s.active)
  const inactive = services.filter((s) => !s.active)

  return (
    <>
      {/* Cabeçalho da página */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Serviços</h1>
          <p className="text-sm text-muted-foreground">
            {services.length === 0
              ? "Nenhum serviço cadastrado ainda."
              : `${active.length} ativo${active.length !== 1 ? "s" : ""} · ${inactive.length} inativo${inactive.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo serviço
        </Button>
      </div>

      {/* Lista vazia */}
      {services.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <DollarSign className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">Nenhum serviço cadastrado</p>
            <p className="text-sm text-muted-foreground">
              Crie seu primeiro serviço para começar a receber agendamentos.
            </p>
          </div>
          <Button onClick={openCreate} variant="outline" className="mt-2 gap-2">
            <Plus className="h-4 w-4" />
            Criar primeiro serviço
          </Button>
        </div>
      )}

      {/* Serviços ativos */}
      {active.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ativos
          </p>
          {active.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              onEdit={openEdit}
              onDeleteRequest={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Serviços inativos */}
      {inactive.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Inativos
          </p>
          {inactive.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              onEdit={openEdit}
              onDeleteRequest={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Sheet de criação/edição */}
      <ServiceFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        service={editService}
      />

      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              O serviço <strong>{deleteTarget?.name}</strong> será excluído permanentemente.
              Agendamentos já realizados não são afetados.
              {deleteTarget?._count.appointments
                ? ` Este serviço tem ${deleteTarget._count.appointments} agendamento(s) no histórico.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Excluindo…</>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
