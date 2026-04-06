"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, CheckCircle, XCircle, MailCheck } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signUp } from "@/lib/actions/auth"

export function RegisterForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [username, setUsername] = useState("")
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameStatus("idle")
      return
    }
    setUsernameStatus("checking")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`)
        const data = await res.json()
        setUsernameStatus(data.available ? "available" : "taken")
      } catch {
        setUsernameStatus("idle")
      }
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [username])

  function formatUsername(value: string) {
    return value.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9_-]/g, "")
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSuccessMessage(null)

    if (usernameStatus === "taken") {
      setError("Este nome de usuário já está em uso.")
      return
    }

    startTransition(async () => {
      const result = await signUp(formData)

      if (result?.error) {
        setError(result.error)
        return
      }

      // Confirmação de e-mail ativa — mostra tela de pendência
      if (result?.success) {
        setSuccessMessage(result.success)
        return
      }

      // Confirmação desativada — a action chama redirect() internamente.
      // Como redirect() lança uma exceção especial do Next.js que não é capturada
      // pelo useTransition, isso funciona corretamente nesse caminho específico.
      // Mas por segurança, também empurramos a navegação aqui:
      router.push("/dashboard")
    })
  }

  if (successMessage) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="h-7 w-7 text-primary" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold text-foreground">Confirme seu e-mail</p>
          <p className="text-sm text-muted-foreground">{successMessage}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Após confirmar, volte aqui e{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            faça login
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Nome do negócio ou seu nome</Label>
        <Input
          id="name" name="name" type="text"
          placeholder="Ex: Barbearia do João"
          autoComplete="name" required disabled={isPending} minLength={2}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email" name="email" type="email"
          placeholder="seu@email.com"
          autoComplete="email" required disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">
          Nome de usuário{" "}
          <span className="text-xs font-normal text-muted-foreground">(sua URL pública)</span>
        </Label>
        <div className="relative">
          <Input
            id="username" name="username" type="text"
            placeholder="joaobarber"
            required disabled={isPending} minLength={3} maxLength={30}
            value={username}
            onChange={(e) => setUsername(formatUsername(e.target.value))}
            className={
              usernameStatus === "available" ? "border-green-500 pr-10"
              : usernameStatus === "taken"   ? "border-destructive pr-10"
              : "pr-10"
            }
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {usernameStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {usernameStatus === "available" && <CheckCircle className="h-4 w-4 text-green-500" />}
            {usernameStatus === "taken"     && <XCircle    className="h-4 w-4 text-destructive" />}
          </span>
        </div>
        {username.length >= 3 && (
          <p className="text-xs text-muted-foreground">
            Sua página:{" "}
            <span className="font-medium text-foreground">agendazap.com/{username}/book</span>
          </p>
        )}
        {usernameStatus === "taken" && (
          <p className="text-xs text-destructive">Este nome já está em uso. Escolha outro.</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Input
            id="password" name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password" required disabled={isPending} minLength={6}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button
        type="submit" className="w-full"
        disabled={isPending || usernameStatus === "taken"}
      >
        {isPending
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando conta...</>
          : "Criar conta grátis"
        }
      </Button>
    </form>
  )
}
