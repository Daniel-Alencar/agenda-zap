// /payment/success
// O Mercado Pago redireciona para cá após pagamento aprovado ou pendente.
// Query params: payment_id, status, external_reference

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { CheckCircle, Clock, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface Props {
  searchParams: Promise<{
    payment_id?:        string
    status?:            string
    external_reference?: string
  }>
}

export default async function PaymentSuccessPage({ searchParams }: Props) {
  const sp = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const status = sp.status ?? "approved"
  const isPending = status === "pending" || status === "in_process"

  // Se aprovado, verifica se o plano já foi ativado pelo webhook
  let planActivated = false
  if (!isPending) {
    const dbUser = await prisma.user.findUnique({
      where:  { id: user.id },
      select: { planStatus: true },
    })
    planActivated = dbUser?.planStatus === "ACTIVE"
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">

        <div className={`flex h-20 w-20 items-center justify-center rounded-full ${isPending ? "bg-amber-500/10" : "bg-green-500/10"}`}>
          {isPending
            ? <Clock className="h-10 w-10 text-amber-500" />
            : <CheckCircle className="h-10 w-10 text-green-600" />
          }
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg bg-primary">
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {isPending ? "Pagamento em análise" : "Pagamento aprovado!"}
          </h1>
          <p className="text-muted-foreground">
            {isPending
              ? "Seu pagamento está sendo processado. Assim que confirmado, seu plano será ativado automaticamente."
              : planActivated
                ? "Seu plano foi ativado com sucesso. Bem-vindo ao AgendaZap!"
                : "Pagamento confirmado! Seu plano será ativado em instantes."
            }
          </p>
        </div>

        {sp.payment_id && (
          <p className="text-xs text-muted-foreground">
            ID do pagamento: <code className="rounded bg-muted px-1.5 py-0.5">{sp.payment_id}</code>
          </p>
        )}

        <div className="flex flex-col gap-3 w-full">
          <Button asChild className="w-full">
            <Link href="/dashboard">
              {planActivated ? "Acessar o dashboard" : "Ir para o dashboard"}
            </Link>
          </Button>
        </div>

      </div>
    </div>
  )
}
