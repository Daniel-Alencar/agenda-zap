"use client"

import { useState, useTransition, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Search, Users, Phone, Mail, Calendar,
  MoreVertical, Trash2, Eye, Loader2, ChevronLeft, ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deleteCustomer } from "@/lib/actions/customers"
import { CustomerDrawer } from "./customer-drawer"
import type { CustomerRow, CustomerFilter } from "@/lib/data/customers"
import { CUSTOMERS_PER_PAGE } from "@/lib/data/customers"

// ── helpers ───────────────────────────────────────────────────────────────────

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^55/, "")
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return phone
}

function lastVisit(customer: CustomerRow): Date | null {
  const last = customer.appointments[0]
  return last ? new Date(last.startTime) : null
}

function customerStatus(customer: CustomerRow): "active" | "inactive" | "new" {
  if (customer._count.appointments === 0) return "new"
  const last = lastVisit(customer)
  if (!last) return "inactive"
  const daysSince = (Date.now() - last.getTime()) / 86400000
  return daysSince <= 90 ? "active" : "inactive"
}

const STATUS_CONFIG = {
  active:   { label: "Ativo",    variant: "default"   as const },
  inactive: { label: "Inativo",  variant: "secondary" as const },
  new:      { label: "Novo",     variant: "outline"   as const },
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CustomerTableProps {
  customers: CustomerRow[]
  total: number
  totalPages: number
  currentPage: number
  currentSearch: string
  currentFilter: CustomerFilter
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CustomerTable({
  customers,
  total,
  totalPages,
  currentPage,
  currentSearch,
  currentFilter,
}: CustomerTableProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  const [searchValue, setSearchValue] = useState(currentSearch)
  const [deleteTarget, setDeleteTarget] = useState<CustomerRow | null>(null)
  const [drawerCustomerId, setDrawerCustomerId] = useState<string | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()

  // ── URL helpers ─────────────────────────────────────────────────────────────

  function pushParams(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString())
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === "") next.delete(k)
      else next.set(k, v)
    })
    // Qualquer mudança de filtro/busca volta para página 1
    if (patch.search !== undefined || patch.filter !== undefined) next.delete("page")
    router.push(`${pathname}?${next.toString()}`)
  }

  // Busca com debounce manual via timeout
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  function handleSearchChange(value: string) {
    setSearchValue(value)
    if (searchTimer) clearTimeout(searchTimer)
    setSearchTimer(
      setTimeout(() => pushParams({ search: value || undefined }), 400)
    )
  }

  function handleFilterChange(f: CustomerFilter) {
    pushParams({ filter: f === "all" ? undefined : f })
  }

  function handlePage(p: number) {
    pushParams({ page: p === 1 ? undefined : String(p) })
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    startDeleteTransition(async () => {
      const result = await deleteCustomer(deleteTarget.id)
      if (result.error) toast.error(result.error)
      else toast.success("Cliente excluído.")
      setDeleteTarget(null)
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const filters: { value: CustomerFilter; label: string }[] = [
    { value: "all",      label: "Todos"    },
    { value: "active",   label: "Ativos"   },
    { value: "inactive", label: "Inativos" },
  ]

  return (
    <>
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {total === 0 ? "Nenhum cliente encontrado." : `${total} cliente${total !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou e-mail…"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                currentFilter === f.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      {customers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {currentSearch ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
            </p>
            <p className="text-sm text-muted-foreground">
              {currentSearch
                ? "Tente ajustar os termos da busca."
                : "Os clientes aparecerão aqui conforme realizarem agendamentos."}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden sm:table-cell">Contato</TableHead>
                <TableHead className="hidden md:table-cell">Última visita</TableHead>
                <TableHead className="hidden lg:table-cell">Agendamentos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => {
                const last   = lastVisit(customer)
                const status = customerStatus(customer)
                return (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer"
                    onClick={() => setDrawerCustomerId(customer.id)}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{customer.name}</span>
                        <span className="text-xs text-muted-foreground sm:hidden">
                          {formatPhone(customer.phone)}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="hidden sm:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-sm">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {formatPhone(customer.phone)}
                        </span>
                        {customer.email && (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3 shrink-0" />
                            {customer.email}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {last ? (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          {format(last, "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      ) : (
                        <span className="text-xs italic">Sem visitas</span>
                      )}
                    </TableCell>

                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {customer._count.appointments}
                    </TableCell>

                    <TableCell>
                      <Badge variant={STATUS_CONFIG[status].variant}>
                        {STATUS_CONFIG[status].label}
                      </Badge>
                    </TableCell>

                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Ações</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDrawerCustomerId(customer.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver histórico
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(customer)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              disabled={currentPage <= 1}
              onClick={() => handlePage(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => handlePage(currentPage + 1)}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Drawer de detalhe */}
      <CustomerDrawer
        customerId={drawerCustomerId}
        onClose={() => setDrawerCustomerId(null)}
      />

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> e todo o histórico de agendamentos associado
              serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Excluindo…</>
                : "Excluir"
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
