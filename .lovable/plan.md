

# Plano: Migrar para Stripe com 3 planos de assinatura

## Resumo

Substituir a integração Cakto pela Stripe para gerenciar assinaturas mensais com 3 planos. Quando o pagamento falhar ou a assinatura for cancelada, o tenant perde acesso a extrações.

## Planos

| Plano | Preço | Leads |
|-------|-------|-------|
| Pro | R$ 47/mes | 6.000 |
| Premium | R$ 97/mes | 14.000 |
| Enterprise | R$ 197/mes | 32.000 |

## Etapas

### 1. Habilitar integração Stripe
- Ativar o Stripe no projeto (vai pedir a chave secreta)
- Criar os 3 produtos e preços na Stripe via ferramenta do Lovable

### 2. Atualizar banco de dados
- Adicionar colunas na tabela `tenants`: `stripe_customer_id`, `stripe_subscription_id`, `stripe_status` (substituindo os campos `cakto_*`)
- Remover colunas Cakto (`cakto_customer_email`, `cakto_subscription_id`)
- Atualizar valores do enum de plano para `pro`, `premium`, `enterprise`

### 3. Criar Edge Function `stripe-webhook`
- Receber eventos do Stripe: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
- No `checkout.session.completed`: criar usuario (se nao existir), ativar tenant, definir plano e limites conforme o preco pago
- No `invoice.paid`: manter `ativo = true`
- No `invoice.payment_failed` / `subscription.deleted`: setar `ativo = false` (bloqueia extrações)

### 4. Criar Edge Function `create-checkout`
- Recebe o `price_id` do plano escolhido
- Cria (ou recupera) um Stripe Customer pelo email do usuario
- Gera uma Checkout Session do Stripe em modo `subscription`
- Retorna a URL do checkout para redirect

### 5. Criar pagina de planos (`/planos`)
- Pagina publica ou acessivel por usuarios logados sem assinatura
- Exibe os 3 cards de plano com preço, limite de leads e botao "Assinar"
- Ao clicar, chama `create-checkout` e redireciona para o Stripe Checkout

### 6. Atualizar ProtectedRoute
- Apos login, verificar se o tenant esta `ativo`
- Se `ativo = false`, redirecionar para `/planos` em vez do dashboard
- Admins globais ficam isentos dessa verificação

### 7. Bloquear extrações para inadimplentes
- Na pagina de ICPs, antes de executar um ICP (run), verificar `tenant.ativo`
- Se inativo, mostrar toast informando que a assinatura esta pendente

### 8. Atualizar Backoffice
- Substituir aba "Cakto" por aba "Assinaturas" mostrando status Stripe de cada tenant
- Exibir: nome do tenant, plano, status da assinatura, stripe_customer_id

### 9. Limpar codigo Cakto
- Remover/substituir o webhook-cakto pela nova logica Stripe
- Remover referencias a Cakto no frontend

---

## Detalhes tecnicos

**Mapeamento plano → limites (aplicado no webhook)**:
- `pro` → 6000
- `premium` → 14000  
- `enterprise` → 32000

**Fluxo do usuario**:
1. Usuario acessa `/planos` e escolhe um plano
2. E redirecionado ao Stripe Checkout (cartao de credito)
3. Apos pagamento, webhook cria conta + tenant + ativa
4. Usuario acessa via "Primeiro Acesso" e define senha
5. Todo mes o Stripe cobra automaticamente; se falhar, `ativo = false`

**Edge Function `stripe-webhook`**: usara `verify_jwt = false` no config.toml e validara a assinatura do webhook via `Stripe-Signature` header com o secret `STRIPE_WEBHOOK_SECRET`.

