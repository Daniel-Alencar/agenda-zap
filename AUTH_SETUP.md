# AgendaZap — Guia de Configuração da Autenticação

## Visão geral do que foi implementado

```
middleware.ts                          → Protege /dashboard, redireciona não autenticados
lib/supabase/client.ts                 → Client Supabase para Client Components
lib/supabase/server.ts                 → Client Supabase para Server Components e Actions
lib/actions/auth.ts                    → Server Actions: signIn, signUp, signOut, etc.
app/auth/callback/route.ts             → Callback OAuth / confirmação de e-mail
app/login/page.tsx                     → Página de login
app/register/page.tsx                  → Página de cadastro
app/forgot-password/page.tsx           → Recuperação de senha
app/reset-password/page.tsx            → Redefinição de senha (via link do e-mail)
app/api/auth/check-username/route.ts   → Verificação de disponibilidade de username
components/auth/login-form.tsx         → Formulário de login
components/auth/register-form.tsx      → Formulário de cadastro
components/auth/forgot-password-form.tsx
components/auth/reset-password-form.tsx
app/dashboard/layout.tsx               → Atualizado: busca usuário real do banco
components/dashboard/header.tsx        → Atualizado: dados reais + logout funcional
components/dashboard/sidebar.tsx       → Atualizado: status real do WhatsApp
prisma/schema.prisma                   → Atualizado: User.id sem @default(cuid())
```

---

## Passo a passo de configuração

### 1. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto
2. Aguarde o banco inicializar (~2 minutos)
3. Vá em **Settings → API** e copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Vá em **Settings → Database → Connection string → URI** e copie a string de conexão:
   - Use **Transaction pooler** (porta 6543) se for fazer deploy na Vercel
   - Use a **conexão direta** (porta 5432) para desenvolvimento local

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
# Edite .env.local com seus valores do Supabase
```

### 3. Instalar dependências do Supabase

```bash
npm install @supabase/supabase-js @supabase/ssr
```

### 4. Configurar o banco de dados

```bash
# Aplica o schema ao banco de dados do Supabase
npx prisma migrate dev --name init

# Ou em produção (sem criar arquivo de migração):
npx prisma db push
```

### 5. Configurar confirmação de e-mail no Supabase (opcional)

Por padrão o Supabase exige confirmação de e-mail. Para desabilitar durante desenvolvimento:

1. Vá em **Authentication → Providers → Email**
2. Desative "Confirm email"

Para produção, mantenha ativado e configure o template do e-mail em **Authentication → Email Templates**.

### 6. Configurar URL de redirecionamento no Supabase

1. Vá em **Authentication → URL Configuration**
2. Em **Site URL**, adicione: `http://localhost:3000` (dev) ou sua URL de produção
3. Em **Redirect URLs**, adicione: `http://localhost:3000/auth/callback`

### 7. Rodar o projeto

```bash
npm run dev
```

---

## Fluxo de autenticação

```
Usuário acessa /dashboard
    ↓
middleware.ts verifica sessão Supabase
    ↓ sem sessão
Redireciona para /login?redirectTo=/dashboard
    ↓ login com sucesso
Server Action signIn() → Supabase Auth
    ↓
Redireciona para /dashboard
    ↓
DashboardLayout busca User no Prisma por authUser.id
    ↓
Renderiza dashboard com dados reais
```

## Fluxo de cadastro

```
Usuário acessa /register
    ↓
RegisterForm verifica disponibilidade do username em tempo real
(/api/auth/check-username)
    ↓
Server Action signUp():
  1. Verifica username no Prisma
  2. Cria usuário no Supabase Auth
  3. Cria registro User no Prisma com id = UUID do Supabase
    ↓
Redireciona para /dashboard
```

---

## Observações importantes

- O `User.id` no Prisma usa o **UUID gerado pelo Supabase Auth** — isso vincula os dois sistemas sem precisar de uma tabela de mapeamento separada.
- O campo `password` no schema Prisma foi mantido por compatibilidade, mas é salvo como string vazia — o Supabase gerencia as senhas internamente com hash bcrypt.
- O middleware usa `supabase.auth.getUser()` (não `getSession()`) para validação segura no servidor, conforme recomendado pela Supabase.
- Rotas `/[username]/book` (página pública de agendamento) **não** são protegidas pelo middleware — clientes finais acessam sem login.
