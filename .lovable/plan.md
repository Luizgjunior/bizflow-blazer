

# Plano: Disparo Massivo de E-mail via Resend

## Resumo

Integrar e-mail em massa usando uma **única conta Resend do administrador** (chave API + remetente verificado) compartilhada por todos os tenants. Adicionar aba "E-mail" na página de Campanhas existente, com fluxo idêntico ao WhatsApp.

## Pré-requisitos

- Secret `RESEND_API_KEY` — já será solicitada ao usuário antes da implementação
- Secret `RESEND_FROM_EMAIL` — e-mail remetente verificado no Resend (ex: `noreply@seudominio.com`)

## Etapas

### 1. Criar tabelas no banco

**`email_campaigns`**: mesma estrutura de `whatsapp_campaigns` adaptada para e-mail
- `id`, `tenant_id`, `nome`, `assunto` (subject), `mensagem` (corpo texto/HTML), `status` (draft/sending/completed), `total_contatos`, `enviados`, `falhas`, `use_ai_variations`, `started_at`, `finished_at`, `created_at`

**`email_campaign_contacts`**: mesma estrutura de `whatsapp_campaign_contacts` adaptada
- `id`, `campaign_id`, `email`, `nome`, `lead_id`, `status` (pending/sent/failed), `error_message`, `sent_at`, `created_at`

RLS: mesmas políticas tenant-scoped das tabelas WhatsApp.

### 2. Criar Edge Function `send-email`

- Valida autenticação e tenant
- Busca contatos pendentes da campanha
- Se `use_ai_variations` ativo, gera variações via IA (mesma lógica do WhatsApp)
- Loop com delay randômico (500ms-5s) chamando `POST https://api.resend.com/emails` com:
  - `from`: `RESEND_FROM_EMAIL` (secret global)
  - `to`: e-mail do contato
  - `subject`: assunto da campanha
  - `html`: corpo com `{nome}` substituído
- Atualiza status de cada contato e contadores em tempo real
- Gera relatório final

### 3. Adicionar aba "E-mail" na página de Campanhas

- Tabs: **WhatsApp** | **E-mail** na `CampanhasPage`
- Aba E-mail com mesma UX: lista de campanhas, criar campanha (nome, assunto, corpo com `{nome}`), toggle IA
- Fonte de contatos: ICPs (extrai e-mails do `raw_json` dos leads) ou CSV (`email;nome`)
- Botão disparar, relatório pós-envio

### 4. Extrair e-mails dos leads

- Na importação por ICP, buscar campo `email` ou `emails` do `raw_json` de cada lead
- Filtrar apenas leads com e-mail válido
- Template CSV para e-mail: `email;nome`

## Arquitetura

```text
┌──────────────┐     ┌──────────────┐     ┌─────────┐
│  Frontend    │────▶│  send-email  │────▶│ Resend  │
│  (Aba Email) │     │ Edge Function│     │   API   │
└──────────────┘     └──────────────┘     └─────────┘
                           │
                     ┌─────▼──────┐
                     │ email_     │
                     │ campaigns  │
                     │ + contacts │
                     └────────────┘
```

Chave Resend e remetente são secrets globais — todos os tenants enviam pelo mesmo domínio verificado.

