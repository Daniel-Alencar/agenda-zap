import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { Check, Crown, Zap, Calendar, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { signOut } from "@/lib/actions/auth"

export const metadata = { title: "Escolha seu plano — AgendaZap" }

const PLANS = [
  {
    id:       "MONTHLY",
    name:     "Mensal",
    price:    "R$ 49",
    period:   "/mês",
    billing:  "Cobrado mensalmente",
    icon:     <Zap className="h-5 w-5" />,
    features: [
      "Agendamentos ilimitados",
      "Bot WhatsApp automático",
      "Lembretes automáticos 24h",
      "Dashboard completo",
      "Página pública de agendamento",
      "Suporte por e-mail",
    ],
    highlight: false,
    badge:     null,
  },
  {
    id:       "ANNUAL",
    name:     "Anual",
    price:    "R$ 39",
    period:   "/mês",
    billing:  "R$ 468 cobrado anualmente",
    icon:     <Crown className="h-5 w-5" />,
    features: [
      "Agendamentos ilimitados",
      "Bot WhatsApp automático",
      "Lembretes automáticos 24h",
      "Dashboard completo",
      "Página pública de agendamento",
      "Suporte prioritário",
    ],
    highlight: true,
    badge:     "Economize 20%",
  },
]

export default async function PricingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { name: true, planStatus: true, trialEndsAt: true },
  })

  const isExpired =
    dbUser?.planStatus === "EXPIRED" ||
    (dbUser?.planStatus === "TRIAL" && dbUser.trialEndsAt < new Date())

  // Se o plano ainda está ativo, volta ao dashboard
  if (!isExpired) redirect("/dashboard")

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-3xl flex flex-col items-center gap-10">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Calendar className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">AgendaZap</h1>
        </div>

        {/* Mensagem */}
        <div className="text-center flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-foreground">
            Seu período gratuito encerrou
          </h2>
          <p className="text-muted-foreground max-w-md">
            Escolha um plano para continuar usando o AgendaZap e não perder seus agendamentos e clientes.
          </p>
        </div>

        {/* Cards de planos */}
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={
                plan.highlight
                  ? "border-primary ring-1 ring-primary relative"
                  : "border-border"
              }
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs font-bold">
                    {plan.badge}
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-3 pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${plan.highlight ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {plan.icon}
                    </div>
                    <span className="font-semibold text-foreground">{plan.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-xs text-muted-foreground">{plan.period}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{plan.billing}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ul className="flex flex-col gap-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href={`https://wa.me/SEUNUMERO?text=${encodeURIComponent(`Olá! Quero assinar o plano ${plan.name} do AgendaZap. Minha conta: ${dbUser?.name}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="w-full gap-2" variant={plan.highlight ? "default" : "outline"}>
                    <MessageCircle className="h-4 w-4" />
                    Assinar plano {plan.name}
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground max-w-sm">
          Para assinar, entre em contato via WhatsApp. Após o pagamento, seu acesso será reativado em até 24 horas.
        </p>

        {/* Sair */}
        <form action={signOut}>
          <button type="submit" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
            Sair da conta
          </button>
        </form>

      </div>
    </div>
  )
}
