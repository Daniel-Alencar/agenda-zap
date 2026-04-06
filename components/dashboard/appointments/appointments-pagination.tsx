"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AppointmentsPaginationProps {
  currentPage: number
  totalPages: number
  total: number
}

export function AppointmentsPagination({
  currentPage,
  totalPages,
  total,
}: AppointmentsPaginationProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  function goTo(p: number) {
    const next = new URLSearchParams(params.toString())
    if (p === 1) next.delete("page")
    else next.set("page", String(p))
    router.push(`${pathname}?${next.toString()}`)
  }

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {total} agendamento{total !== 1 ? "s" : ""} · Página {currentPage} de {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline" size="sm"
          disabled={currentPage <= 1}
          onClick={() => goTo(currentPage - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <Button
          variant="outline" size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => goTo(currentPage + 1)}
        >
          Próxima
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
