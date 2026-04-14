// /payment/failure
// O Mercado Pago redireciona para cá após pagamento recusado.

import { XCircle, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function PaymentFailurePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">

        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="h-10 w-10 text-destructive" />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg bg-primary">
            <Calendar className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Pagamento não concluído</h1>
          <p className="text-muted-foreground">
            Não foi possível processar seu pagamento. Nenhum valor foi cobrado. Você pode tentar novamente ou usar os 7 dias grátis.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <Button asChild className="w-full">
            <Link href="/register">Tentar novamente</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard">Usar 7 dias grátis</Link>
          </Button>
        </div>

      </div>
    </div>
  )
}
