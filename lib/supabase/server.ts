// =============================================
// SUPABASE CLIENT - SERVER
// =============================================
// Use este client em Server Components, Route Handlers e Server Actions.
// Lê e escreve cookies de forma segura no lado do servidor.

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components não podem definir cookies.
            // Isso é seguro de ignorar se o Middleware estiver refrescando sessões.
          }
        },
      },
    }
  )
}
