import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { SubscriptionManager } from "@/components/dashboard/subscription/subscription-manager"

export const metadata = { title: "Assinatura — AgendaZap" }

export default async function SubscriptionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      planStatus:      true,
      planType:        true,
      trialEndsAt:     true,
      planExpiresAt:   true,
      planCancelledAt: true,
    },
  })

  if (!dbUser) redirect("/login")

  return (
    <div className="mx-auto max-w-2xl">
      <SubscriptionManager
        subscription={{
          planStatus:      dbUser.planStatus,
          planType:        dbUser.planType,
          trialEndsAt:     dbUser.trialEndsAt.toISOString(),
          planExpiresAt:   dbUser.planExpiresAt?.toISOString() ?? null,
          planCancelledAt: dbUser.planCancelledAt?.toISOString() ?? null,
        }}
      />
    </div>
  )
}
