import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getBusinessHours } from "@/lib/data/business-hours"
import { HoursEditor } from "@/components/dashboard/settings/hours-editor"

export const metadata = { title: "Configurações — AgendaZap" }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const saved = await getBusinessHours(user.id)

  return (
    <div className="mx-auto max-w-3xl">
      <HoursEditor saved={saved} />
    </div>
  )
}
