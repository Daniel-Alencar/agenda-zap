// =============================================
// PÁGINA INICIAL - LANDING PAGE
// =============================================
// Página de apresentação do AgendaZap

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Calendar, 
  MessageCircle, 
  Clock, 
  Users, 
  Smartphone,
  CheckCircle,
  ArrowRight
} from "lucide-react"

const features = [
  {
    icon: Calendar,
    title: "Agendamento Online",
    description: "Seus clientes agendam 24/7 através de uma página personalizada com seu nome.",
  },
  {
    icon: MessageCircle,
    title: "Integração WhatsApp",
    description: "Receba e confirme agendamentos automaticamente pelo WhatsApp.",
  },
  {
    icon: Clock,
    title: "Lembretes Automáticos",
    description: "Reduza faltas com lembretes enviados automaticamente antes do horário.",
  },
  {
    icon: Users,
    title: "Gestão de Clientes",
    description: "Histórico completo de atendimentos e dados dos seus clientes.",
  },
]

const benefits = [
  "Página de agendamento com seu nome",
  "Confirmação automática por WhatsApp",
  "Dashboard completo de gestão",
  "Relatórios de faturamento",
  "Lembretes para reduzir faltas",
  "Suporte em português",
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Calendar className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">AgendaZap</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link href="/dashboard">
              <Button>Começar Grátis</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Smartphone className="h-4 w-4" />
            Integrado ao WhatsApp
          </div>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Agendamento online que seus clientes vão adorar
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            Simplifique a gestão do seu negócio com agendamento online integrado ao WhatsApp. 
            Seus clientes agendam sozinhos e você recebe tudo organizado.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/dashboard">
              <Button size="lg" className="gap-2">
                Começar Grátis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/joaobarber/book">
              <Button size="lg" variant="outline">
                Ver Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground">
              Tudo que você precisa em um só lugar
            </h2>
            <p className="mt-4 text-muted-foreground">
              Ferramentas poderosas para automatizar seu agendamento
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-card">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold text-foreground">
                Simplifique sua rotina de agendamentos
              </h2>
              <p className="mt-4 text-muted-foreground">
                Pare de perder tempo com ligações e mensagens. 
                Deixe seus clientes agendarem quando quiserem.
              </p>
              <ul className="mt-8 flex flex-col gap-3">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 shrink-0 text-primary" />
                    <span className="text-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/dashboard">
                  <Button size="lg">Criar minha conta</Button>
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-8">
              <div className="flex items-center gap-4 border-b border-border pb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
                  <MessageCircle className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">WhatsApp Business</p>
                  <p className="text-sm text-muted-foreground">Conectado</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm text-muted-foreground">Cliente:</p>
                  <p className="text-foreground">Oi! Quero agendar um horário</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-3">
                  <p className="text-sm text-muted-foreground">Automático:</p>
                  <p className="text-foreground">
                    {"Olá! Para agendar, acesse: agendazap.com/seunegocio/book"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border bg-primary py-20 text-primary-foreground">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold">Comece a usar agora</h2>
          <p className="mt-4 text-primary-foreground/80">
            Crie sua conta gratuita e configure em minutos.
            Sem cartão de crédito.
          </p>
          <div className="mt-8">
            <Link href="/dashboard">
              <Button size="lg" variant="secondary" className="gap-2">
                Criar conta gratuita
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
                <Calendar className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground">AgendaZap</span>
            </div>
            <p className="text-sm text-muted-foreground">
              2024 AgendaZap. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
