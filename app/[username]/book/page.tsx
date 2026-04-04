// =============================================
// PÁGINA PÚBLICA DE AGENDAMENTO
// =============================================
// Esta página é acessada pelo cliente final através da URL:
// /username/book (ex: /joaobarber/book)
// Em produção, você buscaria os dados do lojista pelo username.

import { BookingForm } from "@/components/booking/booking-form"
import { Calendar } from "lucide-react"

// Tipagem dos parâmetros da rota dinâmica
interface BookingPageProps {
  params: Promise<{
    username: string
  }>
}

// Função para buscar dados do lojista (simulada)
// Em produção, você usaria Prisma para buscar do banco
async function getBusinessData(username: string) {
  // Simula busca no banco de dados
  // const user = await prisma.user.findUnique({ where: { username } })
  
  // Dados de exemplo
  return {
    name: "Barbearia do João",
    username: username,
    description: "A melhor barbearia da cidade",
    services: [
      { id: "1", name: "Corte de Cabelo", price: 50, duration: 45 },
      { id: "2", name: "Barba", price: 35, duration: 30 },
      { id: "3", name: "Corte + Barba", price: 75, duration: 60 },
    ],
  }
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { username } = await params
  const business = await getBusinessData(username)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Calendar className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">AgendaZap</span>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto max-w-2xl px-4 py-8">
        <BookingForm 
          businessName={business.name} 
          username={business.username}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center">
        <p className="text-sm text-muted-foreground">
          Agendamento online por{" "}
          <span className="font-medium text-foreground">AgendaZap</span>
        </p>
      </footer>
    </div>
  )
}

// Metadata dinâmica para SEO
export async function generateMetadata({ params }: BookingPageProps) {
  const { username } = await params
  const business = await getBusinessData(username)
  
  return {
    title: `Agendar - ${business.name}`,
    description: `Agende seu horário online com ${business.name}`,
  }
}
