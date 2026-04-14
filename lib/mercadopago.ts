// Configuração e helpers do Mercado Pago
// SDK: npm install mercadopago

import { MercadoPagoConfig, Preference, Payment } from "mercadopago"

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN!

if (!MP_ACCESS_TOKEN) {
  throw new Error("MP_ACCESS_TOKEN não configurado no .env")
}

export const mpClient = new MercadoPagoConfig({
  accessToken: MP_ACCESS_TOKEN,
})

// ── Configuração dos planos ────────────────────────────────────────────────────

export const PLAN_CONFIG = {
  MONTHLY: {
    title:       "AgendaZap — Plano Mensal",
    unit_price:  49.00,
    months:      1,
  },
  ANNUAL: {
    title:       "AgendaZap — Plano Anual",
    unit_price:  468.00,  // 39 × 12
    months:      12,
  },
} as const

// ── Criar preferência de pagamento ───────────────────────────────────────────

export async function createPaymentPreference({
  userId,
  planType,
  userEmail,
}: {
  userId:    string
  planType:  "MONTHLY" | "ANNUAL"
  userEmail: string
}) {
  const plan    = PLAN_CONFIG[planType]
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL!
  const preference = new Preference(mpClient)

  const response = await preference.create({
    body: {
      items: [
        {
          id:          planType,
          title:       plan.title,
          quantity:    1,
          unit_price:  plan.unit_price,
          currency_id: "BRL",
        },
      ],
      payer: {
        email: userEmail,
      },
      // external_reference é o userId — usado no webhook para identificar quem pagou
      external_reference: userId,
      back_urls: {
        success: `${appUrl}/payment/success`,
        failure: `${appUrl}/payment/failure`,
        pending: `${appUrl}/payment/success`, // pending também vai para success com mensagem adequada
      },
      auto_return:         "approved",
      notification_url:    `${appUrl}/api/payment/webhook`,
      statement_descriptor: "AGENDAZAP",
    },
  })

  return response
}
