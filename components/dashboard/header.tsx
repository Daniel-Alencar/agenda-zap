"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { Bell, Menu, Search, LogOut, User, Settings, ExternalLink, Calendar, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { signOut } from "@/lib/actions/auth"
import Link from "next/link"
import { cn } from "@/lib/utils"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Notification {
  id:            string
  type:          string
  title:         string
  body:          string
  read:          boolean
  createdAt:     string
  appointmentId: string | null
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  NEW_BOOKING: {
    icon:  <Calendar className="h-4 w-4" />,
    color: "text-primary",
  },
  BOOKING_CANCELLED: {
    icon:  <X className="h-4 w-4" />,
    color: "text-destructive",
  },
}

// ── Componente de notificações ────────────────────────────────────────────────

function NotificationBell() {
  const [open, setOpen]                   = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [isMarkingRead, startMarkRead]    = useTransition()

  const fetchNotifications = useCallback(async () => {
    try {
      const res  = await fetch("/api/notifications", { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      // silencia erros de rede no polling
    }
  }, [])

  // Busca inicial + polling a cada 30s
  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(id)
  }, [fetchNotifications])

  // Ao abrir o popover, marca todas como lidas
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen && unreadCount > 0) {
      startMarkRead(async () => {
        await fetch("/api/notifications", { method: "PATCH" })
        setUnreadCount(0)
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      })
    }
  }

  // Marca uma notificação individual como lida ao clicar
  async function handleClickNotification(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    await fetch(`/api/notifications/${id}`, { method: "PATCH" })
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notificações</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-0"
        sideOffset={8}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Notificações</span>
          {notifications.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {notifications.filter((n) => !n.read).length === 0
                ? "Todas lidas"
                : `${notifications.filter((n) => !n.read).length} não lida${notifications.filter((n) => !n.read).length !== 1 ? "s" : ""}`}
            </span>
          )}
        </div>

        {/* Lista */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma notificação ainda.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[360px]">
            <div className="flex flex-col">
              {notifications.map((n, i) => {
                const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG["NEW_BOOKING"]
                const href   = n.appointmentId
                  ? `/dashboard/appointments?search=${n.appointmentId}`
                  : "/dashboard/appointments"

                return (
                  <div key={n.id}>
                    <Link
                      href={href}
                      onClick={() => {
                        handleClickNotification(n.id)
                        setOpen(false)
                      }}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                        !n.read && "bg-primary/5"
                      )}
                    >
                      {/* Ícone do tipo */}
                      <div className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        n.type === "BOOKING_CANCELLED"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary"
                      )}>
                        {config.icon}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "text-sm leading-tight",
                            !n.read ? "font-semibold text-foreground" : "font-medium text-foreground"
                          )}>
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground leading-snug line-clamp-2">
                          {n.body}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.createdAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </Link>
                    {i < notifications.length - 1 && (
                      <Separator className="mx-4 w-auto" />
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}

        {/* Rodapé */}
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-2">
              <Link
                href="/dashboard/appointments"
                onClick={() => setOpen(false)}
                className="text-xs text-primary hover:underline"
              >
                Ver todos os agendamentos →
              </Link>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ── Header principal ──────────────────────────────────────────────────────────

interface DashboardHeaderProps {
  userName:  string
  userEmail: string
  username:  string
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

export function DashboardHeader({ userName, userEmail, username }: DashboardHeaderProps) {
  const [isPending, startTransition] = useTransition()

  function handleSignOut() {
    startTransition(async () => { await signOut() })
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      {/* Botão Menu Mobile */}
      <Button variant="ghost" size="icon" className="lg:hidden">
        <Menu className="h-5 w-5" />
        <span className="sr-only">Abrir menu</span>
      </Button>

      {/* Busca */}
      <div className="hidden flex-1 md:flex md:max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar agendamentos, clientes..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-4">

        {/* Notificações */}
        <NotificationBell />

        {/* Menu do Usuário */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium leading-none">{userName}</p>
                <p className="text-xs text-muted-foreground">{userEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* 
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Meu Perfil
              </Link>
            </DropdownMenuItem> 
            */}
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href={`/${username}/book`}
                target="_blank"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Ver minha página
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              disabled={isPending}
              className="flex items-center gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              {isPending ? "Saindo..." : "Sair"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </header>
  )
}
