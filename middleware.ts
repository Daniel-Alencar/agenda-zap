// =============================================
// MIDDLEWARE DE AUTENTICAÇÃO
// =============================================
// Protege rotas do dashboard e redireciona usuários não autenticados.
// Também redireciona usuários autenticados para fora de /login e /register.

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // IMPORTANTE: não adicione lógica entre createServerClient e supabase.auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password"]
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))
  const isProtectedRoute = pathname.startsWith("/dashboard")

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (!user && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Roda em todas as rotas EXCETO:
     * - _next/static, _next/image  (assets do Next.js)
     * - favicon.ico, arquivos de imagem
     * - /api/*  (route handlers — não precisam de proteção por middleware)
     * - /[username]/book  (página pública de agendamento)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
