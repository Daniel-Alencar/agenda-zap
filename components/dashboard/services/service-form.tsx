// =============================================
// FORMULÁRIO DE SERVIÇO (Sheet lateral)
// =============================================
// Usado tanto para criar quanto para editar.
// Abre num Sheet do lado direito para não sair da página.

"use client"

import { useTransition, useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { createService, updateService } from "@/lib/actions/services"
import { toast } from "sonner"

export interface ServiceFormValues {
  id?: string
  name: string
  description: string
  price: number
  duration: number
}

interface ServiceFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Quando presente, opera em modo edição. */
  service?: ServiceFormValues | null
}

export function ServiceFormSheet({ open, onOpenChange, service }: ServiceFormSheetProps) {
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const isEditing = !!service?.id

  // Preenche os campos quando o sheet abre em modo edição
  useEffect(() => {
    if (!open || !formRef.current) return
    const form = formRef.current
    if (service) {
      ;(form.elements.namedItem("name") as HTMLInputElement).value = service.name
      ;(form.elements.namedItem("description") as HTMLTextAreaElement).value = service.description ?? ""
      ;(form.elements.namedItem("price") as HTMLInputElement).value = String(service.price)
      ;(form.elements.namedItem("duration") as HTMLInputElement).value = String(service.duration)
    } else {
      form.reset()
    }
  }, [open, service])

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = isEditing
        ? await updateService(service!.id!, formData)
        : await createService(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(isEditing ? "Serviço atualizado!" : "Serviço criado!")
      onOpenChange(false)
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 sm:max-w-md">
        <SheetHeader className="pb-4">
          <SheetTitle>{isEditing ? "Editar serviço" : "Novo serviço"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Altere os dados do serviço e salve."
              : "Preencha os dados do novo serviço."}
          </SheetDescription>
        </SheetHeader>

        <form
          ref={formRef}
          action={handleSubmit}
          className="flex flex-1 flex-col gap-5 overflow-y-auto px-1 pb-6"
        >
          {/* Nome */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="svc-name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="svc-name"
              name="name"
              placeholder="Ex: Corte de Cabelo"
              required
              maxLength={60}
              disabled={isPending}
            />
          </div>

          {/* Descrição */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="svc-desc">
              Descrição <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="svc-desc"
              name="description"
              placeholder="Descreva o serviço brevemente…"
              maxLength={200}
              rows={3}
              disabled={isPending}
            />
          </div>

          {/* Preço e duração lado a lado */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="svc-price">
                Preço (R$) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  id="svc-price"
                  name="price"
                  type="number"
                  min="0"
                  max="99999.99"
                  step="0.01"
                  placeholder="0,00"
                  required
                  disabled={isPending}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="svc-duration">
                Duração (min) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="svc-duration"
                  name="duration"
                  type="number"
                  min="5"
                  max="480"
                  step="5"
                  placeholder="30"
                  required
                  disabled={isPending}
                  className="pr-10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  min
                </span>
              </div>
            </div>
          </div>

          {/* Botões — grudados no fundo */}
          <div className="mt-auto flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEditing ? "Salvando…" : "Criando…"}</>
              ) : (
                isEditing ? "Salvar alterações" : "Criar serviço"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
