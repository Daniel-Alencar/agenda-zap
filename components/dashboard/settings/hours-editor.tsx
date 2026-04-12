// =============================================
// EDITOR DE HORÁRIOS DE FUNCIONAMENTO
// =============================================
"use client"

import { useState, useEffect, useTransition } from "react"
import { Loader2, Save, Clock } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { saveBusinessHours, type DayPayload } from "@/lib/actions/business-hours"
import type { BusinessHoursRow } from "@/lib/data/business-hours"

// ── Constantes ────────────────────────────────────────────────────────────────

const DAYS = [
  { value: 0, label: "Domingo",       short: "Dom" },
  { value: 1, label: "Segunda-feira", short: "Seg" },
  { value: 2, label: "Terça-feira",   short: "Ter" },
  { value: 3, label: "Quarta-feira",  short: "Qua" },
  { value: 4, label: "Quinta-feira",  short: "Qui" },
  { value: 5, label: "Sexta-feira",   short: "Sex" },
  { value: 6, label: "Sábado",        short: "Sáb" },
]

const SLOT_INTERVALS = [
  { value: 15,  label: "15 minutos" },
  { value: 20,  label: "20 minutos" },
  { value: 30,  label: "30 minutos" },
  { value: 45,  label: "45 minutos" },
  { value: 60,  label: "1 hora"     },
  { value: 90,  label: "1h 30min"   },
  { value: 120, label: "2 horas"    },
]

/** Gera os horários do dia em intervalos de 30 min: "00:00"..."23:30" */
function generateTimeOptions(): string[] {
  const options: string[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
    }
  }
  return options
}
const TIME_OPTIONS = generateTimeOptions()

// ── Tipo de estado local ──────────────────────────────────────────────────────

interface DayState {
  dayOfWeek:    number
  open:         boolean
  openTime:     string
  closeTime:    string
  slotInterval: number
  hasLunch:     boolean
  lunchStart:   string
  lunchEnd:     string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildInitialState(saved: BusinessHoursRow[]): DayState[] {
  return DAYS.map(({ value: dayOfWeek }) => {
    const row = saved.find((r) => r.dayOfWeek === dayOfWeek)
    if (row) {
      return {
        dayOfWeek,
        open:         true,
        openTime:     row.openTime,
        closeTime:    row.closeTime,
        slotInterval: row.slotInterval,
        hasLunch:     !!(row.lunchStart && row.lunchEnd),
        lunchStart:   row.lunchStart ?? "12:00",
        lunchEnd:     row.lunchEnd   ?? "13:00",
      }
    }
    // Dia sem registro no banco = fechado.
    // Não assumimos padrão "aberto" para não criar divergência entre
    // o que o usuário salvou e o que a UI mostra após recarregar.
    return {
      dayOfWeek,
      open:         false,
      openTime:     "09:00",
      closeTime:    "18:00",
      slotInterval: 30,
      hasLunch:     false,
      lunchStart:   "12:00",
      lunchEnd:     "13:00",
    }
  })
}

// ── Sub-componente: linha de um dia ───────────────────────────────────────────

function TimeSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-24 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {TIME_OPTIONS.map((t) => (
          <SelectItem key={t} value={t} className="text-sm">
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function DayRow({
  day,
  onChange,
  disabled,
}: {
  day: DayState
  onChange: (patch: Partial<DayState>) => void
  disabled: boolean
}) {
  const label = DAYS.find((d) => d.value === day.dayOfWeek)!

  return (
    <div className={`flex flex-col gap-3 py-4 ${!day.open ? "opacity-50" : ""}`}>
      {/* Linha principal: toggle + nome + horários + intervalo */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Toggle aberto/fechado */}
        <div className="flex w-36 items-center gap-2 shrink-0">
          <Switch
            checked={day.open}
            onCheckedChange={(open) => onChange({ open })}
            disabled={disabled}
            aria-label={`${label.label} aberto`}
          />
          <span className="text-sm font-medium text-foreground">{label.label}</span>
        </div>

        {day.open ? (
          <>
            {/* Horários de abertura e fechamento */}
            <div className="flex items-center gap-2">
              <TimeSelect
                value={day.openTime}
                onChange={(openTime) => onChange({ openTime })}
                disabled={disabled}
              />
              <span className="text-xs text-muted-foreground">até</span>
              <TimeSelect
                value={day.closeTime}
                onChange={(closeTime) => onChange({ closeTime })}
                disabled={disabled}
              />
            </div>

            {/* Intervalo entre slots */}
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Select
                value={String(day.slotInterval)}
                onValueChange={(v) => onChange({ slotInterval: Number(v) })}
                disabled={disabled}
              >
                <SelectTrigger className="w-32 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLOT_INTERVALS.map(({ value, label: lbl }) => (
                    <SelectItem key={value} value={String(value)} className="text-sm">
                      {lbl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Fechado</span>
        )}
      </div>

      {/* Linha de almoço (só aparece quando o dia está aberto) */}
      {day.open && (
        <div className="ml-8 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={day.hasLunch}
              onCheckedChange={(hasLunch) => onChange({ hasLunch })}
              disabled={disabled}
              aria-label="Intervalo de almoço"
            />
            <span className="text-sm text-muted-foreground">Intervalo de almoço</span>
          </div>

          {day.hasLunch && (
            <div className="flex items-center gap-2">
              <TimeSelect
                value={day.lunchStart}
                onChange={(lunchStart) => onChange({ lunchStart })}
                disabled={disabled}
              />
              <span className="text-xs text-muted-foreground">até</span>
              <TimeSelect
                value={day.lunchEnd}
                onChange={(lunchEnd) => onChange({ lunchEnd })}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

interface HoursEditorProps {
  saved: BusinessHoursRow[]
}

export function HoursEditor({ saved }: HoursEditorProps) {
  const [days, setDays] = useState<DayState[]>(() => buildInitialState(saved))
  const [isPending, startTransition] = useTransition()

  // Sincroniza o estado local toda vez que o Server Component envia novos dados.
  // Isso é necessário porque useState(() => ...) só roda na montagem —
  // quando revalidatePath faz o Server Component rebuscar, a nova prop 'saved'
  // chegaria mas seria ignorada pelo useState sem este useEffect.
  useEffect(() => {
    setDays(buildInitialState(saved))
  }, [saved])

  function updateDay(dayOfWeek: number, patch: Partial<DayState>) {
    setDays((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d))
    )
  }

  function handleSave() {
    // Monta o payload tipado para a Server Action
    const payload: DayPayload[] = days.map((d) => ({
      dayOfWeek:    d.dayOfWeek,
      open:         d.open,
      openTime:     d.openTime,
      closeTime:    d.closeTime,
      slotInterval: d.slotInterval,
      hasLunch:     d.hasLunch,
      lunchStart:   d.hasLunch ? d.lunchStart : null,
      lunchEnd:     d.hasLunch ? d.lunchEnd   : null,
    }))

    startTransition(async () => {
      const result = await saveBusinessHours(payload)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Horários salvos com sucesso!")
      }
    })
  }

  // Atalhos rápidos
  function applyWeekdays() {
    setDays((prev) =>
      prev.map((d) => ({
        ...d,
        open: d.dayOfWeek >= 1 && d.dayOfWeek <= 5,
      }))
    )
  }

  function applyAllWeek() {
    setDays((prev) => prev.map((d) => ({ ...d, open: true })))
  }

  function applySaturday() {
    setDays((prev) =>
      prev.map((d) => ({
        ...d,
        open: d.dayOfWeek >= 1 && d.dayOfWeek <= 6,
      }))
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Horários de Funcionamento</h1>
          <p className="text-sm text-muted-foreground">
            Configure os dias e horários em que seu negócio atende.
            Os clientes só poderão agendar nos horários disponíveis.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isPending} className="gap-2 shrink-0">
          {isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Salvando…</>
          ) : (
            <><Save className="h-4 w-4" />Salvar horários</>
          )}
        </Button>
      </div>

      {/* Atalhos */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Atalhos:</span>
        <Button variant="outline" size="sm" onClick={applyWeekdays} disabled={isPending}>
          Seg–Sex
        </Button>
        <Button variant="outline" size="sm" onClick={applySaturday} disabled={isPending}>
          Seg–Sáb
        </Button>
        <Button variant="outline" size="sm" onClick={applyAllWeek} disabled={isPending}>
          Todos os dias
        </Button>
      </div>

      {/* Grade de dias */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Dias e Horários</CardTitle>
          <CardDescription>
            Ative cada dia e defina o horário de abertura, fechamento e intervalo entre agendamentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border px-6">
          {days.map((day, i) => (
            <DayRow
              key={day.dayOfWeek}
              day={day}
              onChange={(patch) => updateDay(day.dayOfWeek, patch)}
              disabled={isPending}
            />
          ))}
        </CardContent>
      </Card>

      {/* Legenda */}
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Como funciona</p>
        <p>
          O <strong>intervalo entre agendamentos</strong> define de quanto em quanto tempo os clientes
          podem agendar. Por exemplo: com 30 minutos e abertura às 09:00, os slots serão 09:00, 09:30, 10:00…
        </p>
        <p className="mt-1">
          O <strong>intervalo de almoço</strong> bloqueia os horários naquele período —
          nenhum slot será oferecido enquanto o serviço se sobrepõe ao almoço.
        </p>
      </div>

      {/* Botão de salvar duplicado no fim para telas longas */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending} className="gap-2">
          {isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Salvando…</>
          ) : (
            <><Save className="h-4 w-4" />Salvar horários</>
          )}
        </Button>
      </div>
    </div>
  )
}
