

# Webhook Universal - Casa dos Dados

## O que sera feito

Um webhook unico e fixo que recebe dados da Casa dos Dados e distribui automaticamente para **todos os tenants** do sistema. Cada tenant recebe os leads deduplicados no seu proprio espaco.

## Mudancas necessarias

### 1. Migration: tornar `run_id` nullable

A tabela `leads` exige `run_id NOT NULL`, mas leads vindos do webhook nao tem run. Precisamos:

```sql
ALTER TABLE public.leads ALTER COLUMN run_id DROP NOT NULL;
```

### 2. Reescrever Edge Function `webhook-cnpj`

Logica atual (errada): exige `tenant_id` no payload.

Nova logica:
- Recebe POST da Casa dos Dados (formato `{ data_evento, evento: [...] }` ou array flat)
- Valida via `WEBHOOK_SECRET` no header (opcional)
- Busca **todos os tenants ativos** do sistema
- Para cada tenant, deduplica por CNPJ e insere os leads novos
- Responde 200 com contagem de inseridos

```text
POST /webhook-cnpj
  |
  v
Valida secret (opcional)
  |
  v
Parseia payload Casa dos Dados
  |
  v
Busca todos os tenants
  |
  v
Para cada tenant:
  - Busca CNPJs existentes
  - Filtra duplicados
  - Insere leads com run_id=null, tags=["webhook","casa-dos-dados"]
  |
  v
Responde 200
```

Campos mapeados do payload Casa dos Dados:

| Casa dos Dados | Campo leads |
|---|---|
| cnpj | cnpj |
| razao_social | razao_social |
| uf | uf |
| municipio | municipio |
| cnae_fiscal | cnae_principal |
| situacao_cadastral | situacao |
| data_inicio_atividade | data_abertura |
| (objeto completo) | raw_json |

### 3. Atualizar `WebhookPage.tsx`

Simplificar a pagina para mostrar:
- A URL unica e fixa do webhook (sem tokens, sem tenant_id)
- Instrucoes claras: "Cole esta URL no painel da Casa dos Dados em Portal > API > Webhook"
- Exemplo do payload que a Casa dos Dados envia
- Remover referencias a `tenant_id` nos exemplos
- Manter botao de copiar URL

### 4. Arquivos modificados

- `supabase/migrations/xxx.sql` - run_id nullable
- `supabase/functions/webhook-cnpj/index.ts` - reescrita completa
- `src/pages/WebhookPage.tsx` - UI simplificada

