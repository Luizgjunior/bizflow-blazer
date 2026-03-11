

# Plano: Disparos WhatsApp com conexão via QR Code na sua UazAPI

## Resumo

Cada tenant conecta seu WhatsApp escaneando um QR Code direto no sistema. O QR Code é gerado pela sua instância UazAPI (centralizada). O tenant não precisa acessar o painel da UazAPI. Inclui envio de texto, mídia e templates, com suporte a leads prospectados e upload de planilha.

---

## Pré-requisito: Secrets

Armazenar suas credenciais UazAPI como secrets do backend:
- `UAZAPI_URL` — URL base da sua instância (ex: `https://seudominio.uazapi.com`)
- `UAZAPI_TOKEN` — Token de admin da sua conta UazAPI

Essas credenciais são suas (dono do sistema), não do tenant.

---

## 1. Banco de Dados — Novas tabelas

**`whatsapp_instances`** — Instância WhatsApp por tenant:
- `id`, `tenant_id` (unique), `instance_name` (gerado automaticamente, ex: `tenant_{uuid_curto}`), `status` (disconnected/connecting/connected), `phone_number`, `created_at`, `updated_at`

**`whatsapp_campaigns`** — Campanhas de disparo:
- `id`, `tenant_id`, `nome`, `mensagem`, `media_url`, `media_type`, `tipo` (texto/media/template), `status` (draft/sending/completed/failed), `total_contatos`, `enviados`, `falhas`, `created_at`, `started_at`, `finished_at`

**`whatsapp_campaign_contacts`** — Contatos de cada campanha:
- `id`, `campaign_id`, `telefone`, `nome`, `cnpj`, `lead_id` (nullable), `status` (pending/sent/failed), `error_message`, `sent_at`, `created_at`

RLS: Todas tenant-scoped + admin_global, seguindo padrão existente.

**Storage bucket `whatsapp-media`** — Para uploads de mídia dos disparos.

---

## 2. Edge Functions

### `whatsapp-instance` — Gerenciar instância do tenant
- **POST /connect**: Cria instância na UazAPI (`POST {UAZAPI_URL}/instance/create`) com nome auto-gerado, retorna QR Code (`GET {UAZAPI_URL}/instance/qr/{instance}`)
- **GET /status**: Consulta status da conexão (`GET {UAZAPI_URL}/instance/connectionState/{instance}`)
- **POST /disconnect**: Desconecta (`DELETE {UAZAPI_URL}/instance/logout/{instance}`)
- Usa `UAZAPI_URL` e `UAZAPI_TOKEN` do servidor — tenant nunca vê as credenciais

### `send-whatsapp` — Processar envio de campanha
- Recebe `campaign_id`, lê contatos pendentes
- Envia via UazAPI usando a instância do tenant: `/message/sendText`, `/message/sendMedia`
- Delay entre mensagens (1-3s) para evitar bloqueio
- Atualiza status de cada contato e contadores da campanha

---

## 3. Frontend — Página `/disparos`

### Aba "WhatsApp" — Conexão
- Card mostrando status da conexão (conectado/desconectado)
- Botão **"Conectar WhatsApp"** → abre dialog com QR Code gerado pela edge function
- QR Code atualiza automaticamente (polling a cada 5s até conectar)
- Ao escanear, status muda para "Conectado" com o número exibido
- Botão "Desconectar" quando já conectado

### Aba "Campanhas" — Criar e gerenciar disparos
- Botão "Nova Campanha" → formulário:
  - Nome, tipo (texto/mídia/template), conteúdo, upload de mídia
  - Selecionar contatos: **leads prospectados** (multi-select da tabela leads) OU **upload planilha** (CSV com telefone, nome)
- Lista de campanhas com progresso, status, ações (iniciar/ver detalhes)
- Detalhes da campanha: lista de contatos com status individual

### Parser de planilha
- Upload CSV client-side com preview antes de importar
- Colunas: `telefone` (obrigatório), `nome`, `cnpj`

---

## 4. Navegação

- Novo item "Disparos" no sidebar (`Send` ou `MessageSquare` icon)
- Rota protegida `/disparos`
- Adicionado ao bottom nav mobile

---

## 5. Landing Page

Adicionar na lista `FEATURES`:
```
{ icon: MessageSquare, title: 'Disparos WhatsApp', desc: 'Conecte seu WhatsApp e envie mensagens em massa para seus leads — texto, mídia e templates.' }
```

Adicionar nos `STEPS` e nos features dos planos (Premium e Enterprise).

Adicionar FAQ: "Como funciona o disparo de WhatsApp?" → "Basta conectar seu WhatsApp escaneando um QR Code dentro do sistema e criar sua campanha de disparo."

---

## O que NÃO será alterado

Nenhuma página ou funcionalidade existente. Apenas adições: nova página, novas tabelas, novas edge functions, novo item no menu, novo card na landing.

