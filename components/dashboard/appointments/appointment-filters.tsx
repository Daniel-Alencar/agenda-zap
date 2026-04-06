"use client"

import { useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Search, CalendarIcon, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { StatusFilter, PeriodFilter } from "@/lib/data/appointments"

interface AppointmentFiltersProps {
  currentSearch: string
  currentStatus: StatusFilter
  currentPeriod: PeriodFilter
  currentDate: string
  counts: { pending: number; confirmed: number; upcoming: number }
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all",       label: "Todos os status"  },
  { value: "PENDING",   label: "Pendente"          },
  { value: "CONFIRMED", label: "Confirmado"        },
  { value: "COMPLETED", label: "Concluído"         },
  { value: "CANCELLED", label: "Cancelado"         },
]

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "upcoming", label: "Próximos"       },
  { value: "today",    label: "Hoje"           },
  { value: "week",     label: "Esta semana"    },
  { value: "month",    label: "Este mês"       },
  { value: "custom",   label: "Data específica"},
  { value: "all",      label: "Todos"          },
]

export function AppointmentFilters({
  currentSearch,
  currentStatus,
  currentPeriod,
  currentDate,
  counts,
}: AppointmentFiltersProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  const [searchValue, setSearchValue] = useState(currentSearch)
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const selectedDate = currentDate
    ? (() => {
        const d = new Date(currentDate + "T00:00:00")
        return isNaN(d.getTime()) ? undefined : d
      })()
    : undefined

  function pushParams(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString())
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === "") next.delete(k)
      else next.set(k, v)
    })
    // Qualquer mudança de filtro volta para página 1
    next.delete("page")
    router.push(`${pathname}?${next.toString()}`)
  }

  function handleSearch(value: string) {
    setSearchValue(value)
    if (searchTimer) clearTimeout(searchTimer)
    setSearchTimer(
      setTimeout(() => pushParams({ search: value || undefined }), 400)
    )
  }

  function handleStatus(value: string) {
    pushParams({ status: value === "all" ? undefined : value })
  }

  function handlePeriod(value: string) {
    if (value === "custom") {
      pushParams({ period: "custom" })
    } else {
      pushParams({ period: value === "upcoming" ? undefined : value, date: undefined })
    }
  }

  function handleDateSelect(d: Date | undefined) {
    if (!d) return
    pushParams({ period: "custom", date: format(d, "yyyy-MM-dd") })
    setCalendarOpen(false)
  }

  function clearFilters() {
    setSearchValue("")
    pushParams({ search: undefined, status: undefined, period: undefined, date: undefined })
  }

  const hasActiveFilters =
    currentSearch || currentStatus !== "all" || currentPeriod !== "upcoming" || currentDate

  return (
    <div className="flex flex-col gap-3">
      {/* Linha 1: busca + status + período */}
      <div className="flex flex-wrap gap-2">
        {/* Busca */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente ou serviço…"
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status */}
        <Select value={currentStatus} onValueChange={handleStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Período */}
        <Select value={currentPeriod} onValueChange={handlePeriod}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date picker — só aparece quando período = custom */}
        {currentPeriod === "custom" && (
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[160px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate
                  ? format(selectedDate, "dd/MM/yyyy")
                  : "Escolha a data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        )}

        {/* Limpar filtros */}
        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters} className="h-10 w-10">
            <X className="h-4 w-4" />
            <span className="sr-only">Limpar filtros</span>
          </Button>
        )}
      </div>

      {/* Linha 2: atalhos rápidos de status com contagem */}
      <div className="flex flex-wrap gap-2">
        {counts.upcoming > 0 && (
          <button
            onClick={() => pushParams({ period: undefined, status: undefined, date: undefined })}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              currentPeriod === "upcoming" && currentStatus === "all"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            Próximos
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {counts.upcoming}
            </span>
          </button>
        )}
        {counts.pending > 0 && (
          <button
            onClick={() => pushParams({ status: "PENDING", period: undefined, date: undefined })}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              currentStatus === "PENDING"
                ? "border-amber-500 bg-amber-500/10 text-amber-700"
                : "border-border text-muted-foreground hover:border-amber-400 hover:text-foreground"
            )}
          >
            Pendentes
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              {counts.pending}
            </span>
          </button>
        )}
        {counts.confirmed > 0 && (
          <button
            onClick={() => pushParams({ status: "CONFIRMED", period: undefined, date: undefined })}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              currentStatus === "CONFIRMED"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            Confirmados
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {counts.confirmed}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
