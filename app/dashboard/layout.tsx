// =============================================
// LAYOUT DO DASHBOARD
// =============================================
// Layout compartilhado para todas as páginas do dashboard.
// Inclui sidebar de navegação e header.

import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar de Navegação */}
      <DashboardSidebar />
      
      {/* Conteúdo Principal */}
      <div className="flex flex-1 flex-col">
        <DashboardHeader />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
