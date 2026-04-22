"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"

interface DashboardShellProps {
  children:          React.ReactNode
  userName:          string
  userEmail:         string
  username:          string
  whatsappConnected: boolean
  planStatus?:       "TRIAL" | "ACTIVE" | "EXPIRED"
  trialEndsAt?:      string | null
  planExpiresAt?:    string | null
}

export function DashboardShell({
  children,
  userName,
  userEmail,
  username,
  whatsappConnected,
  planStatus,
  trialEndsAt,
  planExpiresAt,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Fecha o sidebar automaticamente ao navegar (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Bloqueia o scroll do body quando o sidebar mobile está aberto
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [sidebarOpen])

  return (
    <div className="flex min-h-screen bg-background">

      {/* Overlay escuro — aparece atrás do sidebar mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        whatsappConnected={whatsappConnected}
        planStatus={planStatus}
        trialEndsAt={trialEndsAt}
        planExpiresAt={planExpiresAt}
      />

      {/* Conteúdo principal */}
      <div className="flex flex-1 flex-col min-w-0">
        <DashboardHeader
          userName={userName}
          userEmail={userEmail}
          username={username}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

    </div>
  )
}
