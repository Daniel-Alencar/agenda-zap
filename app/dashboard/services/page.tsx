// =============================================
// PÁGINA DE SERVIÇOS — Server Component
// =============================================

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServices } from "@/lib/data/services"
import { ServiceList } from "@/components/dashboard/services/service-list"

export const metadata = { title: "Serviços — AgendaZap" }

export default async function ServicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const services = await getServices(user.id)

  return (
    <div className="flex flex-col gap-6">
      <ServiceList services={services} />
    </div>
  )
}
