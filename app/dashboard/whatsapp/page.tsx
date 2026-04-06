import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { WhatsAppConnect } from "@/components/dashboard/whatsapp/whatsapp-connect"

export const metadata = { title: "WhatsApp — AgendaZap" }

export default async function WhatsAppPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { evolutionInstanceName: true, evolutionConnected: true },
  })

  return (
    <div className="mx-auto max-w-2xl">
      <WhatsAppConnect
        initialState={{
          instanceName: dbUser?.evolutionInstanceName ?? null,
          connected: dbUser?.evolutionConnected ?? false,
        }}
      />
    </div>
  )
}
