// =============================================
// MIDDLEWARE DE AUTENTICAÇÃO
// =============================================
// Protege rotas do dashboard e redireciona usuários não autenticados.
// Também redireciona usuários autenticados para fora de /login e /register.

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: não adicione lógica entre createServerClient e supabase.auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rotas que só podem ser acessadas por usuários NÃO autenticados
  const authRoutes = ["/login", "/register", "/forgot-password"]
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))

  // Rotas protegidas que exigem autenticação
  const isProtectedRoute = pathname.startsWith("/dashboard")

  // Usuário autenticado tentando acessar página de auth → redireciona pro dashboard
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Usuário NÃO autenticado tentando acessar rota protegida → redireciona pro login
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
     * Aplica o middleware em todas as rotas exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     * - Rotas públicas de agendamento (/[username]/book)
     * - Arquivos de imagem
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
