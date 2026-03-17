

## Problem

When a WhatsApp contact doesn't have a `pushName` (saved name), the chat list shows the raw remoteJid digits (e.g., `237512345784459`) instead of a formatted phone number like WhatsApp Web does (e.g., `+55 11 99999-9999`).

## Solution

1. **Add a phone number formatter** in `WhatsAppChatPage.tsx` that formats raw digits into a readable phone format, similar to WhatsApp Web:
   - Brazilian numbers (55...): `+55 11 99999-9999`
   - International numbers: `+XX XX XXXXX-XXXX` (generic grouping)
   - Short/unknown formats: prefix with `+` and group digits

2. **Update `parseChat`** to use the formatter when the name falls back to the phone number (i.e., when there's no `pushName` or `name` from the API).

### Technical Detail

In `parseChat` (line 66), currently:
```typescript
const name = raw.name || raw.pushName || phone;
```

Will become:
```typescript
const name = raw.name || raw.pushName || formatPhoneDisplay(phone);
```

Where `formatPhoneDisplay` formats digits like:
- `5511999999999` → `+55 11 99999-9999`
- `237512345784459` → `+237 51 23457-84459` (best-effort grouping)
- Already handles country code detection for BR numbers

