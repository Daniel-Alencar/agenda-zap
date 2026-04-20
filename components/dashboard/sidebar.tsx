"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Calendar,
  Users,
  Scissors,
  Settings,
  LayoutDashboard,
  MessageCircle,
  CreditCard,
} from "lucide-react"

const navigation = [
  { name: "Dashboard",      href: "/dashboard",              icon: LayoutDashboard },
  { name: "Agendamentos",   href: "/dashboard/appointments", icon: Calendar        },
  { name: "Serviços",       href: "/dashboard/services",     icon: Scissors        },
  { name: "Clientes",       href: "/dashboard/customers",    icon: Users           },
  { name: "WhatsApp",       href: "/dashboard/whatsapp",     icon: MessageCircle   },
  { name: "Configurações",  href: "/dashboard/settings",     icon: Settings        },
]

interface DashboardSidebarProps {
  whatsappConnected?: boolean
  planStatus?:   "TRIAL" | "ACTIVE" | "EXPIRED"
  trialEndsAt?:  string | null  // ISO string
  planExpiresAt?: string | null
}

function PlanBadge({
  planStatus,
  trialEndsAt,
  planExpiresAt,
}: Pick<DashboardSidebarProps, "planStatus" | "trialEndsAt" | "planExpiresAt">) {
  if (!planStatus) return null

  const now = new Date()

  if (planStatus === "EXPIRED") {
    return (
      <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
        Expirado
      </span>
    )
  }

  if (planStatus === "ACTIVE") {
    const exp = planExpiresAt ? new Date(planExpiresAt) : null
    // Avisa se expira em menos de 7 dias
    const expiring = exp && (exp.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000
    return (
      <span className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        expiring
          ? "bg-amber-500/15 text-amber-700"
          : "bg-green-500/15 text-green-700"
      )}>
        {expiring ? "Expirando" : "Ativo"}
      </span>
    )
  }

  // TRIAL
  if (trialEndsAt) {
    const end      = new Date(trialEndsAt)
    const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000))
    const expired  = end < now

    if (expired) {
      return (
        <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
          Expirado
        </span>
      )
    }
    return (
      <span className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        daysLeft <= 2
          ? "bg-destructive/15 text-destructive"
          : "bg-amber-500/15 text-amber-700"
      )}>
        {daysLeft}d grátis
      </span>
    )
  }

  return null
}

export function DashboardSidebar({
  whatsappConnected = false,
  planStatus,
  trialEndsAt,
  planExpiresAt,
}: DashboardSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="hidden w-64 flex-col border-r border-border bg-card lg:flex">
      {/* Logo */}
      <Link href="/">
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Calendar className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">AgendaZap</span>
        </div>
      </Link>

      {/* Navegação principal */}
      <nav className="flex-1 p-4">
        <ul className="flex flex-col gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </li>
            )
          })}

          {/* Item de plano separado com badge de status */}
          <li className="mt-2 border-t border-border pt-2">
            <Link
              href="/pricing"
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/pricing"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-3">
                <CreditCard className="h-4 w-4" />
                Plano
              </span>
              <PlanBadge
                planStatus={planStatus}
                trialEndsAt={trialEndsAt}
                planExpiresAt={planExpiresAt}
              />
            </Link>
          </li>
        </ul>
      </nav>

      {/* Status da Conexão WhatsApp */}
      <div className="border-t border-border p-4">
        <Link href="/dashboard/whatsapp">
          <div className="flex items-center gap-3 rounded-lg bg-muted p-3 transition-colors hover:bg-muted/80">
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full",
              whatsappConnected ? "bg-green-500/10" : "bg-destructive/10"
            )}>
              <MessageCircle className={cn(
                "h-4 w-4",
                whatsappConnected ? "text-green-600" : "text-destructive"
              )} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">WhatsApp</p>
              <p className="text-xs text-muted-foreground">
                {whatsappConnected ? "Conectado" : "Desconectado"}
              </p>
            </div>
            {whatsappConnected && (
              <span className="h-2 w-2 rounded-full bg-green-500" />
            )}
          </div>
        </Link>
      </div>
    </aside>
  )
}
