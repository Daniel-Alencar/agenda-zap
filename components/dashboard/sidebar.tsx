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
  X,
} from "lucide-react"

const navigation = [
  { name: "Dashboard",     href: "/dashboard",              icon: LayoutDashboard },
  { name: "Agendamentos",  href: "/dashboard/appointments", icon: Calendar        },
  { name: "Serviços",      href: "/dashboard/services",     icon: Scissors        },
  { name: "Clientes",      href: "/dashboard/customers",    icon: Users           },
  { name: "WhatsApp",      href: "/dashboard/whatsapp",     icon: MessageCircle   },
  { name: "Configurações", href: "/dashboard/settings",     icon: Settings        },
]

interface DashboardSidebarProps {
  /** Controla visibilidade no mobile — passado pelo DashboardShell */
  open?:             boolean
  /** Fecha o sidebar no mobile */
  onClose?:          () => void
  whatsappConnected?: boolean
  planStatus?:       "TRIAL" | "ACTIVE" | "EXPIRED"
  trialEndsAt?:      string | null
  planExpiresAt?:    string | null
}

// ── Badge de status do plano ──────────────────────────────────────────────────

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
    const exp      = planExpiresAt ? new Date(planExpiresAt) : null
    const expiring = exp !== null && (exp.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000
    return (
      <span className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        expiring ? "bg-amber-500/15 text-amber-700" : "bg-green-500/15 text-green-700"
      )}>
        {expiring ? "Expirando" : "Ativo"}
      </span>
    )
  }

  // TRIAL
  if (trialEndsAt) {
    const end      = new Date(trialEndsAt)
    const expired  = end < now
    const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000))

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
        daysLeft <= 2 ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-700"
      )}>
        {daysLeft}d grátis
      </span>
    )
  }

  return null
}

// ── Componente principal ──────────────────────────────────────────────────────

export function DashboardSidebar({
  open = false,
  onClose,
  whatsappConnected = false,
  planStatus,
  trialEndsAt,
  planExpiresAt,
}: DashboardSidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        // Dimensões e visual
        "flex w-64 flex-shrink-0 flex-col border-r border-border bg-card",

        // ── Desktop (lg+): sempre visível, estático no layout normal ──
        "lg:static lg:translate-x-0 lg:flex",

        // ── Mobile: drawer por cima do conteúdo ──
        // Posicionado fixo, cobre a tela inteira em altura
        "fixed inset-y-0 left-0 z-40",
        // Transição suave
        "transition-transform duration-300 ease-in-out",
        // Aberto → visível | Fechado → escondido para a esquerda
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* ── Cabeçalho: logo + botão fechar (mobile) ── */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Calendar className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">AgendaZap</span>
        </Link>

        {/* Só aparece no mobile */}
        <button
          onClick={onClose}
          aria-label="Fechar menu"
          className="rounded-md p-1 text-muted-foreground hover:text-foreground lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── Navegação ── */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="flex flex-col gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  onClick={onClose} // fecha o drawer ao navegar no mobile
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

          {/* Item de plano com badge de status */}
          <li className="mt-2 border-t border-border pt-2">
            <Link
              href="/pricing"
              onClick={onClose}
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

      {/* ── Status WhatsApp ── */}
      <div className="border-t border-border p-4">
        <Link href="/dashboard/whatsapp" onClick={onClose}>
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
