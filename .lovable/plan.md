

## Plano: Gestão de Usuários no Backoffice + Login via Magic Link (Cakto)

### Contexto
- A aba "Usuários" no Backoffice é somente leitura. Precisa virar um painel completo de CRUD.
- O webhook Cakto já cria usuários sem senha, mas as colunas `cakto_customer_email` e `cakto_subscription_id` foram removidas da tabela `tenants` numa migração posterior — precisam ser recriadas.
- O login precisa suportar Magic Link para usuários vindos da Cakto (sem senha).

### O que será feito

**1. Migração de banco de dados**
- Re-adicionar `cakto_customer_email` e `cakto_subscription_id` na tabela `tenants`

**2. Backoffice — UsersTab completa**
- Botão "Novo Usuário" com dialog: nome, email, tenant (select dos tenants existentes), role
- Criação via edge function `manage-users` (usa `supabase.auth.admin`) — cria o auth user sem senha + profile + role + vincula ao tenant
- Após criar, envia magic link automaticamente para o email do usuário
- Editar usuário: alterar nome, tenant, role
- Excluir usuário: remove do auth + cascade deleta profile/role
- Botão "Reenviar Magic Link" por usuário
- Toggle ativar/desativar tenant do usuário

**3. Edge Function `manage-users`**
- Ações: `create`, `update`, `delete`, `send-magic-link`
- `create`: `supabase.auth.admin.createUser()` sem senha, `email_confirm: true`, depois gera magic link via `supabase.auth.admin.generateLink({ type: 'magiclink' })` e usa a infra existente ou retorna o link
- `delete`: `supabase.auth.admin.deleteUser()`
- `send-magic-link`: `supabase.auth.admin.generateLink({ type: 'magiclink' })`

**4. Login — suporte a Magic Link**
- Adicionar modo "Magic Link" na tela de login: usuário informa email, recebe link por email, clica e entra logado
- Usar `supabase.auth.signInWithOtp({ email })` no frontend
- Manter os modos existentes (login com senha, primeiro acesso, signup)

**5. Webhook Cakto — ajuste**
- Após criar o usuário, enviar magic link automaticamente via `supabase.auth.admin.generateLink()`
- Atualizar para usar as colunas cakto restauradas

### Arquivos envolvidos

| Arquivo | Ação |
|---|---|
| Migração SQL | Re-adicionar colunas cakto no tenants |
| `supabase/functions/manage-users/index.ts` | Criar (nova edge function) |
| `src/pages/BackofficePage.tsx` | Reescrever UsersTab com CRUD completo |
| `src/pages/LoginPage.tsx` | Adicionar modo Magic Link |
| `supabase/functions/webhook-cakto/index.ts` | Enviar magic link após criar usuário |
| `supabase/config.toml` | Adicionar `verify_jwt = false` para manage-users |

### Fluxo do usuário Cakto

```text
Compra na Cakto
  → Webhook recebe email
  → Cria auth user (sem senha) + tenant + profile
  → Envia magic link por email
  → Usuário clica no link → logado direto
  → Próximos acessos: login via magic link ou define senha
```

