// =============================================
// FORMULÁRIO DE AGENDAMENTO — integrado à API real
// =============================================
"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  CalendarIcon, Clock, Scissors, User, Phone,
  CheckCircle, Loader2, AlertCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface ServiceOption {
  id: string
  name: string
  description: string | null
  price: number
  duration: number
}

interface BookingFormProps {
  businessName: string
  username: string
  services: ServiceOption[]
}

// ── Schema de validação ───────────────────────────────────────────────────────
const bookingSchema = z.object({
  serviceId:     z.string().min(1, "Selecione um serviço"),
  date:          z.date({ required_error: "Selecione uma data" }),
  time:          z.string().min(1, "Selecione um horário"),
  customerName:  z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  customerPhone: z.string().min(10, "Telefone inválido").regex(/^\d+$/, "Apenas números"),
  notes:         z.string().optional(),
})

type BookingFormData = z.infer<typeof bookingSchema>

// ── Componente ────────────────────────────────────────────────────────────────
export function BookingForm({ businessName, username, services }: BookingFormProps) {
  const [step, setStep] = useState(1)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Estado dos slots
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [dayClosed, setDayClosed] = useState(false)

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors },
  } = useForm<BookingFormData>({ resolver: zodResolver(bookingSchema) })

  const watchedDate      = watch("date")
  const watchedTime      = watch("time")
  const watchedServiceId = watch("serviceId")

  const selectedService = services.find((s) => s.id === watchedServiceId) ?? null

  // ── Busca slots na API sempre que data ou serviço mudam ──────────────────
  const fetchSlots = useCallback(async (serviceId: string, date: Date) => {
    setSlotsLoading(true)
    setSlotsError(null)
    setDayClosed(false)
    setSlots([])
    // Reseta o horário selecionado ao mudar data/serviço
    setValue("time", "")

    const dateStr = format(date, "yyyy-MM-dd")
    try {
      const res = await fetch(
        `/api/slots?username=${encodeURIComponent(username)}&serviceId=${encodeURIComponent(serviceId)}&date=${dateStr}`
      )
      const data = await res.json()

      if (!res.ok) {
        setSlotsError(data.error ?? "Erro ao buscar horários.")
        return
      }

      if (data.closed) {
        setDayClosed(true)
        return
      }

      setSlots(data.slots ?? [])
      if ((data.slots ?? []).length === 0) {
        setSlotsError("Nenhum horário disponível nesta data.")
      }
    } catch {
      setSlotsError("Erro de conexão. Tente novamente.")
    } finally {
      setSlotsLoading(false)
    }
  }, [username, setValue])

  useEffect(() => {
    if (watchedServiceId && watchedDate) {
      fetchSlots(watchedServiceId, watchedDate)
    }
  }, [watchedServiceId, watchedDate, fetchSlots])

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (data: BookingFormData) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          serviceId:     data.serviceId,
          date:          format(data.date, "yyyy-MM-dd"),
          time:          data.time,
          customerName:  data.customerName,
          customerPhone: data.customerPhone,
          notes:         data.notes,
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        setSubmitError(result.error ?? "Erro ao criar agendamento. Tente novamente.")
        return
      }
      setIsSubmitted(true)
    } catch {
      setSubmitError("Erro de conexão. Verifique sua internet e tente novamente.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Tela de sucesso ───────────────────────────────────────────────────────
  if (isSubmitted) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Agendamento Realizado!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Você receberá uma confirmação pelo WhatsApp em breve.
            </p>
          </div>
          <div className="w-full rounded-lg bg-muted p-4 text-left text-sm">
            <p className="text-muted-foreground">Resumo:</p>
            <p className="mt-1 font-medium">{selectedService?.name}</p>
            <p className="text-muted-foreground">
              {watchedDate && format(watchedDate, "dd 'de' MMMM", { locale: ptBR })} às {watchedTime}
            </p>
          </div>
          <Button
            variant="outline" className="w-full"
            onClick={() => { setIsSubmitted(false); setStep(1); reset() }}
          >
            Fazer novo agendamento
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-foreground">{businessName}</h1>
        <p className="text-muted-foreground">Agende seu horário online</p>
      </div>

      {/* Indicador de passos */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
            step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            {s}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>

        {/* ── Passo 1: Serviço ── */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scissors className="h-5 w-5" /> Escolha o Serviço
              </CardTitle>
              <CardDescription>Selecione o serviço que deseja agendar</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {services.map((service) => (
                <button
                  key={service.id} type="button"
                  onClick={() => setValue("serviceId", service.id)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-4 text-left transition-colors",
                    watchedServiceId === service.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div>
                    <p className="font-medium text-foreground">{service.name}</p>
                    {service.description && (
                      <p className="text-xs text-muted-foreground">{service.description}</p>
                    )}
                    <p className="text-sm text-muted-foreground">{service.duration} minutos</p>
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    {Number(service.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </button>
              ))}
              {errors.serviceId && (
                <p className="text-sm text-destructive">{errors.serviceId.message}</p>
              )}
              <Button
                type="button" className="mt-2"
                disabled={!watchedServiceId}
                onClick={() => setStep(2)}
              >
                Continuar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Passo 2: Data e Hora ── */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" /> Escolha Data e Hora
              </CardTitle>
              <CardDescription>Selecione quando deseja ser atendido</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">

              {/* Calendário */}
              <div className="flex flex-col gap-2">
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("justify-start text-left font-normal", !watchedDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {watchedDate
                        ? format(watchedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                        : "Selecione uma data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={watchedDate}
                      onSelect={(date) => date && setValue("date", date)}
                      disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
              </div>

              {/* Slots */}
              {watchedDate && (
                <div className="flex flex-col gap-2">
                  <Label>Horário disponível</Label>

                  {slotsLoading && (
                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verificando horários disponíveis...
                    </div>
                  )}

                  {!slotsLoading && dayClosed && (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Fechado neste dia. Selecione outra data.
                    </div>
                  )}

                  {!slotsLoading && slotsError && !dayClosed && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {slotsError}
                    </div>
                  )}

                  {!slotsLoading && !dayClosed && slots.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {slots.map((slot) => (
                        <button
                          key={slot} type="button"
                          onClick={() => setValue("time", slot)}
                          className={cn(
                            "flex items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors",
                            watchedTime === slot
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}

                  {errors.time && <p className="text-sm text-destructive">{errors.time.message}</p>}
                </div>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                <Button
                  type="button" className="flex-1"
                  disabled={!watchedDate || !watchedTime || slotsLoading}
                  onClick={() => setStep(3)}
                >
                  Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Passo 3: Dados do cliente ── */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Seus Dados
              </CardTitle>
              <CardDescription>Informe seus dados para finalizar o agendamento</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">

              {/* Resumo */}
              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs text-muted-foreground">Resumo</p>
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedService?.name}</p>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" /> {selectedService?.duration} min
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {selectedService && Number(selectedService.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {watchedDate && format(watchedDate, "dd/MM")} — {watchedTime}
                    </p>
                  </div>
                </div>
              </div>

              {submitError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {submitError}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="customerName">Nome completo</Label>
                <Input id="customerName" placeholder="Digite seu nome" {...register("customerName")} />
                {errors.customerName && <p className="text-sm text-destructive">{errors.customerName.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="customerPhone">WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="customerPhone" placeholder="11999999999"
                    className="pl-10" {...register("customerPhone")}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Você receberá a confirmação por WhatsApp</p>
                {errors.customerPhone && <p className="text-sm text-destructive">{errors.customerPhone.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Textarea id="notes" placeholder="Alguma observação especial?" {...register("notes")} />
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={isSubmitting}>
                  Voltar
                </Button>
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Confirmando...</>
                    : "Confirmar Agendamento"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  )
}
