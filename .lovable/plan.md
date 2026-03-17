

## Diagnosis

Based on my investigation:

1. **Send message works at the API level** - I tested the edge function directly and it successfully sent a message to the Evolution API. The send endpoint and payload are correct.

2. **markRead uses wrong HTTP method** - The code uses `PUT` for `/chat/markMessageAsRead/{instance}` but Evolution API v2 requires `POST`. This causes a 404 error every time a chat is opened. While this doesn't directly block sending, it could cause confusion in error handling.

3. **Possible frontend timing issue** - The session replay shows the send button entering a loading state but no network request was captured for the `send` action. This could be a transient issue, or the request may have failed silently at the network level.

## Plan

### 1. Fix markRead HTTP method (PUT → POST)
In `supabase/functions/whatsapp-chats/index.ts`, change line 309 from `method: "PUT"` to `method: "POST"` for the `markMessageAsRead` endpoint.

### 2. Add error resilience to send action
Add a `try/catch` wrapper around the `handleSend` in `WhatsAppChatPage.tsx` to ensure any fetch error is properly surfaced via toast, and add a `console.error` for debugging.

### 3. Ensure `apiCall` handles non-JSON error responses
The current `apiCall` function (line 219) calls `res.json()` directly. If the edge function returns a non-JSON error (e.g., a 502 gateway error), this will throw silently. Add a status check before parsing JSON.

### 4. Redeploy edge function
Deploy the updated `whatsapp-chats` function with the markRead fix.

### Technical details

**Edge function change** (`supabase/functions/whatsapp-chats/index.ts`):
- Line 309: `method: "PUT"` → `method: "POST"`

**Frontend change** (`src/pages/WhatsAppChatPage.tsx`):
- `apiCall` function: Check `res.ok` before parsing JSON; if not ok, read error text and throw
- This ensures send errors are always visible to the user instead of being swallowed

