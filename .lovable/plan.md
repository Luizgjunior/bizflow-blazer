

## Plano: Chat WhatsApp em tempo real + envio + mobile-first

### Problemas identificados

1. **Envio retorna 405**: O endpoint `/message/text` esta errado. O `send-whatsapp` (campanhas) usa `/message/sendText` e funciona. Precisa corrigir.
2. **Mensagens do chat errado**: O `/message/find` com `phone` nao filtra por chat corretamente. Precisa usar `chatid` no body.
3. **Sem atualização em tempo real**: Nao ha polling. Precisa adicionar auto-refresh.
4. **Mobile-first**: A interface precisa de ajustes para priorizar mobile.

### Alteracoes

#### 1. Edge Function `whatsapp-chats/index.ts`
- **Send**: Trocar `/message/text` por `/message/sendText` (mesmo endpoint que funciona nas campanhas)
- **Messages**: Enviar `chatid` no body do `/message/find` ao inves de apenas `phone`, para garantir que retorna as mensagens do chat correto

#### 2. Frontend `WhatsAppChatPage.tsx`
- **Polling de mensagens**: Adicionar `setInterval` de 5s para recarregar mensagens do chat selecionado automaticamente
- **Polling de chats**: Adicionar `setInterval` de 15s para atualizar a lista de conversas (novas mensagens, unread count)
- **Mobile-first refactor**:
  - Sidebar ocupa 100% da tela no mobile (ja faz isso parcialmente)
  - Area de mensagens ocupa 100% com botao voltar
  - Input de mensagem com tamanho adequado para touch (min h-11)
  - Botoes com tamanho minimo de 44px para touch targets
  - Remover botoes decorativos (emoji/paperclip) no mobile para economizar espaco
  - Avatar e fontes ajustados para mobile

### Detalhes tecnicos

```text
Edge Function Fix:
  /message/text  →  /message/sendText  (fix 405)
  { phone }      →  { chatid }         (fix wrong messages)

Polling:
  Messages: 5s interval (only when chat selected)
  Chat list: 15s interval (silent, no loading spinner)
```

