

# Corrigir conta da alinecarlaasilva01@gmail.com

## Situação atual

| Campo | Valor |
|-------|-------|
| User ID | `b4a06698-45ba-45eb-b53f-e6cd5977dfa7` |
| Nome | ALINE |
| tenant_id | `null` |
| role | `null` |

## Ações necessárias

Executar 3 operações via SQL (migration tool):

1. **Criar tenant** para "ALINE" com plano `pro`, `ativo = true`, e `cakto_customer_email = 'alinecarlaasilva01@gmail.com'`

2. **Atualizar profile** — associar o `tenant_id` do novo tenant ao profile existente

3. **Inserir role** — atribuir `empresa` na tabela `user_roles`

Tudo em uma única migration SQL:

```sql
WITH new_tenant AS (
  INSERT INTO public.tenants (nome, plano, ativo, cakto_customer_email)
  VALUES ('ALINE', 'pro', true, 'alinecarlaasilva01@gmail.com')
  RETURNING id
)
, update_profile AS (
  UPDATE public.profiles
  SET tenant_id = (SELECT id FROM new_tenant)
  WHERE id = 'b4a06698-45ba-45eb-b53f-e6cd5977dfa7'
)
INSERT INTO public.user_roles (user_id, role)
VALUES ('b4a06698-45ba-45eb-b53f-e6cd5977dfa7', 'empresa');
```

Após isso a usuária poderá fazer login e acessar o sistema normalmente.

