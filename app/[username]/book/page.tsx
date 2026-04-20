import { notFound } from "next/navigation"
import { Calendar } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { BookingForm } from "@/components/booking/booking-form"
import Link from "next/link"

interface BookingPageProps {
  params: Promise<{ username: string }>
}

async function getBusinessData(username: string) {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      name: true,
      username: true,
      services: {
        where: { active: true },
        select: { id: true, name: true, description: true, price: true, duration: true },
        orderBy: { name: "asc" },
      },
    },
  })
  return user
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { username } = await params
  const business = await getBusinessData(username)

  if (!business) notFound()

  // Converte Decimal do Prisma para number (JSON-serializable)
  const services = business.services.map((s) => ({
    ...s,
    price: Number(s.price),
  }))

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <Link href="/">
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 px-4 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Calendar className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">AgendaZap</span>
          </div>
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {services.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <p className="text-lg font-medium">Nenhum serviço disponível no momento.</p>
            <p className="text-sm">Entre em contato diretamente com o estabelecimento.</p>
          </div>
        ) : (
          <BookingForm
            businessName={business.name}
            username={business.username}
            services={services}
          />
        )}
      </main>

      <footer className="border-t border-border py-6 text-center">
        <p className="text-sm text-muted-foreground">
          Agendamento online por{" "}
          <span className="font-medium text-foreground">AgendaZap</span>
        </p>
      </footer>
    </div>
  )
}

export async function generateMetadata({ params }: BookingPageProps) {
  const { username } = await params
  const business = await getBusinessData(username)
  if (!business) return {}
  return {
    title: `Agendar — ${business.name}`,
    description: `Agende seu horário online com ${business.name}`,
  }
}
