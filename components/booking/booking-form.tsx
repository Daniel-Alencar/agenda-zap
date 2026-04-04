// =============================================
// FORMULÁRIO DE AGENDAMENTO
// =============================================
// Componente cliente para o formulário de agendamento.
// O cliente final escolhe serviço, data/hora e insere seus dados.

"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, Clock, Scissors, User, Phone, CheckCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// Esquema de validação do formulário
const bookingSchema = z.object({
  serviceId: z.string().min(1, "Selecione um serviço"),
  date: z.date({ required_error: "Selecione uma data" }),
  time: z.string().min(1, "Selecione um horário"),
  customerName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  customerPhone: z
    .string()
    .min(10, "Telefone inválido")
    .regex(/^[0-9]+$/, "Apenas números"),
  notes: z.string().optional(),
})

type BookingFormData = z.infer<typeof bookingSchema>

// Serviços de exemplo (em produção, viriam do banco)
const services = [
  { id: "1", name: "Corte de Cabelo", price: 50, duration: 45 },
  { id: "2", name: "Barba", price: 35, duration: 30 },
  { id: "3", name: "Corte + Barba", price: 75, duration: 60 },
  { id: "4", name: "Manicure", price: 40, duration: 40 },
  { id: "5", name: "Pedicure", price: 45, duration: 45 },
]

// Horários disponíveis (em produção, viriam da API baseados na agenda)
const availableTimes = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
]

interface BookingFormProps {
  businessName: string
  username: string
}

export function BookingForm({ businessName, username }: BookingFormProps) {
  const [step, setStep] = useState(1)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [selectedService, setSelectedService] = useState<typeof services[0] | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
  })

  const watchedDate = watch("date")
  const watchedTime = watch("time")
  const watchedServiceId = watch("serviceId")

  // Handler para seleção de serviço
  const handleServiceSelect = (serviceId: string) => {
    setValue("serviceId", serviceId)
    const service = services.find((s) => s.id === serviceId)
    setSelectedService(service || null)
  }

  // Handler para submissão do formulário
  const onSubmit = async (data: BookingFormData) => {
    console.log("[v0] Booking form submitted:", data)
    
    // Aqui você faria a chamada à API para criar o agendamento
    // await fetch(`/api/${username}/book`, { method: 'POST', body: JSON.stringify(data) })
    
    // Simula sucesso
    setIsSubmitted(true)
  }

  // Tela de sucesso após agendamento
  if (isSubmitted) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Agendamento Realizado!
            </h2>
            <p className="mt-2 text-muted-foreground">
              Seu agendamento foi enviado com sucesso. Você receberá uma
              confirmação pelo WhatsApp em breve.
            </p>
          </div>
          <div className="w-full rounded-lg bg-muted p-4 text-left">
            <p className="text-sm text-muted-foreground">Resumo:</p>
            <p className="font-medium">{selectedService?.name}</p>
            <p className="text-sm text-muted-foreground">
              {watchedDate && format(watchedDate, "dd 'de' MMMM", { locale: ptBR })} às {watchedTime}
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setIsSubmitted(false)
              setStep(1)
            }}
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

      {/* Indicador de Passos */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
              step >= s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {s}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Passo 1: Escolher Serviço */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scissors className="h-5 w-5" />
                Escolha o Serviço
              </CardTitle>
              <CardDescription>
                Selecione o serviço que deseja agendar
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {services.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => handleServiceSelect(service.id)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-4 text-left transition-colors",
                    watchedServiceId === service.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div>
                    <p className="font-medium text-foreground">{service.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {service.duration} minutos
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    R$ {service.price.toFixed(2).replace(".", ",")}
                  </p>
                </button>
              ))}
              {errors.serviceId && (
                <p className="text-sm text-destructive">{errors.serviceId.message}</p>
              )}
              <Button
                type="button"
                className="mt-4"
                disabled={!watchedServiceId}
                onClick={() => setStep(2)}
              >
                Continuar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Passo 2: Escolher Data e Hora */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Escolha Data e Hora
              </CardTitle>
              <CardDescription>
                Selecione quando deseja ser atendido
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {/* Calendário */}
              <div className="flex flex-col gap-2">
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !watchedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {watchedDate ? (
                        format(watchedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      ) : (
                        "Selecione uma data"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={watchedDate}
                      onSelect={(date) => date && setValue("date", date)}
                      disabled={(date) =>
                        date < new Date() || date.getDay() === 0
                      }
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                {errors.date && (
                  <p className="text-sm text-destructive">{errors.date.message}</p>
                )}
              </div>

              {/* Horários */}
              <div className="flex flex-col gap-2">
                <Label>Horário</Label>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {availableTimes.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setValue("time", time)}
                      className={cn(
                        "flex items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors",
                        watchedTime === time
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {time}
                    </button>
                  ))}
                </div>
                {errors.time && (
                  <p className="text-sm text-destructive">{errors.time.message}</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={!watchedDate || !watchedTime}
                  onClick={() => setStep(3)}
                >
                  Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Passo 3: Dados do Cliente */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Seus Dados
              </CardTitle>
              <CardDescription>
                Informe seus dados para finalizar o agendamento
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Resumo do Agendamento */}
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-medium text-muted-foreground">Resumo</p>
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedService?.name}</p>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {selectedService?.duration} min
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      R$ {selectedService?.price.toFixed(2).replace(".", ",")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {watchedDate && format(watchedDate, "dd/MM")} - {watchedTime}
                    </p>
                  </div>
                </div>
              </div>

              {/* Nome */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="customerName">Nome completo</Label>
                <Input
                  id="customerName"
                  placeholder="Digite seu nome"
                  {...register("customerName")}
                />
                {errors.customerName && (
                  <p className="text-sm text-destructive">
                    {errors.customerName.message}
                  </p>
                )}
              </div>

              {/* WhatsApp */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="customerPhone">WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="customerPhone"
                    placeholder="11999999999"
                    className="pl-10"
                    {...register("customerPhone")}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Você receberá a confirmação por WhatsApp
                </p>
                {errors.customerPhone && (
                  <p className="text-sm text-destructive">
                    {errors.customerPhone.message}
                  </p>
                )}
              </div>

              {/* Observações */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Alguma observação especial?"
                  {...register("notes")}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                >
                  Voltar
                </Button>
                <Button type="submit" className="flex-1">
                  Confirmar Agendamento
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  )
}
