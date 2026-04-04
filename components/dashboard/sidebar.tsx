// =============================================
// SIDEBAR DO DASHBOARD
// =============================================
// Navegação lateral do dashboard do lojista.

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
  MessageCircle
} from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Agendamentos", href: "/dashboard/appointments", icon: Calendar },
  { name: "Serviços", href: "/dashboard/services", icon: Scissors },
  { name: "Clientes", href: "/dashboard/customers", icon: Users },
  { name: "WhatsApp", href: "/dashboard/whatsapp", icon: MessageCircle },
  { name: "Configurações", href: "/dashboard/settings", icon: Settings },
]

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-64 flex-col border-r border-border bg-card lg:flex">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Calendar className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold text-foreground">AgendaZap</span>
      </div>

      {/* Navegação */}
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
        </ul>
      </nav>

      {/* Status da Conexão WhatsApp */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
            <MessageCircle className="h-4 w-4 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">WhatsApp</p>
            <p className="text-xs text-muted-foreground">Desconectado</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
