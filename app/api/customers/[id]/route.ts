// GET /api/customers/[id]
// Retorna detalhe completo do cliente para o drawer.
// Requer sessão autenticada — o middleware não cobre /api/, então
// verificamos a sessão diretamente aqui.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCustomerDetail } from "@/lib/data/customers"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await params
  const customer = await getCustomerDetail(id, user.id)

  if (!customer) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 })
  }

  return NextResponse.json(customer)
}
