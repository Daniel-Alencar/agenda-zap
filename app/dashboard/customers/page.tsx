import { redirect } from "next/navigation"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getCustomers, type CustomerFilter } from "@/lib/data/customers"
import { CustomerTable } from "@/components/dashboard/customers/customer-table"

export const metadata = { title: "Clientes — AgendaZap" }

interface CustomersPageProps {
  searchParams: Promise<{
    search?: string
    filter?: string
    page?: string
  }>
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const sp = await searchParams
  const search = (sp.search ?? "").trim()
  const filter = (["all", "active", "inactive"].includes(sp.filter ?? "")
    ? sp.filter
    : "all") as CustomerFilter
  const page = Math.max(1, Number(sp.page) || 1)

  const { customers, total, totalPages } = await getCustomers(user.id, {
    search,
    filter,
    page,
  })

  return (
    <div className="flex flex-col gap-6">
      <CustomerTable
        customers={customers}
        total={total}
        totalPages={totalPages}
        currentPage={page}
        currentSearch={search}
        currentFilter={filter}
      />
    </div>
  )
}
