"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  MessageCircle, CheckCircle, XCircle, Loader2,
  RefreshCw, Wifi, WifiOff, Copy, ExternalLink, AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { setupWhatsApp, disconnectWhatsApp } from "@/lib/actions/whatsapp"

// ── Tipos ─────────────────────────────────────────────────────────────────────

type ConnectionState = "not_configured" | "close" | "connecting" | "open" | "loading"

interface WhatsAppConnectProps {
  /** Estado inicial vindo do Server Component */
  initialState: {
    instanceName: string | null
    connected: boolean
  }
}

// ── Componente ────────────────────────────────────────────────────────────────

export function WhatsAppConnect({ initialState }: WhatsAppConnectProps) {
  const router = useRouter()

  const [connState, setConnState] = useState<ConnectionState>(
    initialState.connected
      ? "open"
      : initialState.instanceName
        ? "close"
        : "not_configured"
  )
  const [instanceName, setInstanceName] = useState<string | null>(initialState.instanceName)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError]   = useState<string | null>(null)
  const [qrExpiry, setQrExpiry] = useState<number>(0) // timestamp de expiração
  const [isSetupPending, startSetupTransition] = useTransition()
  const [isDisconnectPending, startDisconnectTransition] = useTransition()

  const isConnected  = connState === "open"
  const isConnecting = connState === "connecting" || connState === "loading"
  const showQR       = !isConnected && !!instanceName && !!qrCode

  // ── Polling de status ──────────────────────────────────────────────────────

  const pollStatus = useCallback(async () => {
    try {
      const res  = await fetch("/api/whatsapp/status", { cache: "no-store" })
      const data = await res.json()

      if (!res.ok) return

      const newState: ConnectionState =
        data.state === "open"       ? "open"
        : data.state === "connecting" ? "connecting"
        : data.state === "close"      ? "close"
        : "not_configured"

      setConnState(newState)
      setInstanceName(data.instanceName)

      // Quando conectar, limpa o QR e revalida o layout para atualizar o sidebar
      if (newState === "open") {
        setQrCode(null)
        router.refresh()
      }
    } catch {
      // silencia erros de rede no polling
    }
  }, [router])

  // Polling a cada 5s enquanto não está conectado e tem instância
  useEffect(() => {
    if (isConnected || !instanceName) return
    const id = setInterval(pollStatus, 5000)
    return () => clearInterval(id)
  }, [isConnected, instanceName, pollStatus])

  // ── Busca QR Code ──────────────────────────────────────────────────────────

  const fetchQR = useCallback(async () => {
    if (!instanceName) return
    setQrLoading(true)
    setQrError(null)

    try {
      const res  = await fetch("/api/whatsapp/qrcode", { cache: "no-store" })
      const data = await res.json()

      if (data.connected) {
        setConnState("open")
        setQrCode(null)
        router.refresh()
        return
      }

      if (!res.ok || !data.qrcode) {
        setQrError(data.error ?? "Não foi possível gerar o QR Code. Tente novamente.")
        return
      }

      setQrCode(data.qrcode)
      // QR expira em 30s — agenda refresh automático
      setQrExpiry(Date.now() + 29_000)
    } catch {
      setQrError("Erro de conexão. Verifique se a Evolution API está rodando.")
    } finally {
      setQrLoading(false)
    }
  }, [instanceName, router])

  // Busca QR quando a instância é criada ou quando muda de estado
  useEffect(() => {
    if (instanceName && !isConnected) {
      fetchQR()
    }
  }, [instanceName, isConnected, fetchQR])

  // Renova o QR automaticamente antes de expirar
  useEffect(() => {
    if (!qrExpiry || isConnected) return
    const msLeft = qrExpiry - Date.now()
    if (msLeft <= 0) return
    const id = setTimeout(() => fetchQR(), msLeft)
    return () => clearTimeout(id)
  }, [qrExpiry, isConnected, fetchQR])

  // ── Actions ────────────────────────────────────────────────────────────────

  function handleSetup() {
    startSetupTransition(async () => {
      setConnState("loading")
      const result = await setupWhatsApp()
      if (result.error) {
        toast.error(result.error)
        setConnState("not_configured")
        return
      }
      setInstanceName(result.instanceName ?? null)
      setConnState("connecting")
      // fetchQR será disparado pelo useEffect quando instanceName mudar
    })
  }

  function handleDisconnect() {
    startDisconnectTransition(async () => {
      const result = await disconnectWhatsApp()
      if (result.error) {
        toast.error(result.error)
        return
      }
      setConnState("close")
      setQrCode(null)
      toast.success("WhatsApp desconectado.")
      router.refresh()
    })
  }

  function copyWebhookUrl() {
    const url = `${window.location.origin}/api/webhook/evolution`
    navigator.clipboard.writeText(url)
    toast.success("URL copiada!")
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Conecte seu WhatsApp para enviar confirmações e receber agendamentos.
        </p>
      </div>

      {/* Card de status + QR */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Status da Conexão
            </CardTitle>
            <StatusBadge state={connState} />
          </div>
          <CardDescription>
            {isConnected
              ? "Seu WhatsApp está conectado e pronto para enviar mensagens."
              : "Escaneie o QR Code com o WhatsApp para conectar."}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">

          {/* Estado: não configurado */}
          {connState === "not_configured" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <WifiOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Nenhuma instância configurada</p>
                <p className="text-sm text-muted-foreground">
                  Clique em "Conectar WhatsApp" para começar.
                </p>
              </div>
              <Button onClick={handleSetup} disabled={isSetupPending} className="gap-2">
                {isSetupPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Configurando…</>
                  : <><MessageCircle className="h-4 w-4" />Conectar WhatsApp</>
                }
              </Button>
            </div>
          )}

          {/* Estado: carregando / conectando sem QR ainda */}
          {(connState === "loading" || (connState === "connecting" && !qrCode && !qrError)) && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {connState === "loading" ? "Criando instância…" : "Gerando QR Code…"}
              </p>
            </div>
          )}

          {/* QR Code */}
          {!isConnected && !!instanceName && (qrCode || qrError) && (
            <div className="flex flex-col items-center gap-4">

              {qrError ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                  </div>
                  <p className="text-sm text-destructive text-center">{qrError}</p>
                  <Button variant="outline" size="sm" onClick={fetchQR} disabled={qrLoading} className="gap-2">
                    <RefreshCw className={`h-4 w-4 ${qrLoading ? "animate-spin" : ""}`} />
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <>
                  {/* QR Code como imagem base64 */}
                  <div className="relative rounded-xl border-2 border-border p-3 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      // src={`data:image/png;base64,${qrCode}`}
                      src={`${qrCode}`}
                      alt="QR Code do WhatsApp"
                      className="h-56 w-56"
                      draggable={false}
                    />
                    {qrLoading && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    )}
                  </div>

                  {/* Instruções */}
                  <div className="flex flex-col gap-1.5 text-center text-sm text-muted-foreground max-w-xs">
                    <p className="font-medium text-foreground">Como conectar:</p>
                    <p>1. Abra o WhatsApp no celular</p>
                    <p>2. Toque em <strong>Dispositivos Conectados</strong></p>
                    <p>3. Toque em <strong>Conectar Dispositivo</strong></p>
                    <p>4. Aponte a câmera para o QR Code acima</p>
                  </div>

                  <Button
                    variant="outline" size="sm"
                    onClick={fetchQR} disabled={qrLoading}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${qrLoading ? "animate-spin" : ""}`} />
                    Renovar QR Code
                  </Button>
                </>
              )}

            </div>
          )}

          {/* Estado: fechado — tem instância mas não está conectado */}
          {connState === "close" && !qrCode && !qrError && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <WifiOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">WhatsApp desconectado</p>
                <p className="text-sm text-muted-foreground">
                  Gere um novo QR Code para reconectar.
                </p>
              </div>
              <Button onClick={fetchQR} disabled={qrLoading} className="gap-2">
                {qrLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando…</>
                  : <><RefreshCw className="h-4 w-4" />Gerar QR Code</>
                }
              </Button>
            </div>
          )}

          {/* Estado: conectado */}
          {isConnected && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">WhatsApp Conectado!</p>
                <p className="text-sm text-muted-foreground">
                  Agendamentos e lembretes serão enviados automaticamente.
                </p>
              </div>
              {instanceName && (
                <p className="text-xs text-muted-foreground">
                  Instância: <code className="rounded bg-muted px-1 py-0.5">{instanceName}</code>
                </p>
              )}
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={isDisconnectPending}
                className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                {isDisconnectPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Desconectando…</>
                  : <><XCircle className="h-4 w-4" />Desconectar</>
                }
              </Button>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Card de configuração do webhook */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração do Webhook</CardTitle>
          <CardDescription>
            Configure esta URL na Evolution API para receber mensagens dos clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3">
            <code className="flex-1 truncate text-sm text-foreground">
              {typeof window !== "undefined"
                ? `${window.location.origin}/api/webhook/evolution`
                : "/api/webhook/evolution"}
            </code>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copyWebhookUrl}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <Separator />

          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Como configurar:</p>
            <ol className="flex flex-col gap-1 list-decimal list-inside">
              <li>Acesse o painel da sua Evolution API</li>
              <li>Vá em <strong>Settings → Webhooks</strong></li>
              <li>Cole a URL acima no campo de webhook</li>
              <li>Selecione os eventos: <code className="rounded bg-muted px-1">messages.upsert</code> e <code className="rounded bg-muted px-1">connection.update</code></li>
              <li>Salve as configurações</li>
            </ol>
          </div>

          <a
            href="https://doc.evolution-api.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Documentação da Evolution API
          </a>

        </CardContent>
      </Card>

    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ state }: { state: ConnectionState }) {
  if (state === "open") {
    return (
      <Badge className="gap-1.5 bg-green-500/10 text-green-700 border-green-500/30 hover:bg-green-500/10">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
        Conectado
      </Badge>
    )
  }
  if (state === "connecting" || state === "loading") {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        Conectando
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1.5 text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      Desconectado
    </Badge>
  )
}
