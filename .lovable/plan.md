

## Problem

In `fetchChats`, the flow is:
1. `setLoadingChats(true)` (line 786)
2. API returns chats successfully
3. `setChats([...parsed])` (line 815) — chats are set in state
4. `await Promise.all([enrichPromise, picsPromise])` — waits for enrichment + profile pics
5. `setLoadingChats(false)` — only in the `finally` block AFTER Promise.all

But `ChatList` (line 420) shows the loading spinner whenever `loading` is true, **hiding all chats** even though they're already in state. If the `profilePics` or enrichment requests are slow or fail silently, the user sees a perpetual spinner.

## Solution

**File: `src/pages/WhatsAppChatPage.tsx`**

Move `setLoadingChats(false)` to RIGHT AFTER `setChats([...parsed])` on line 815, BEFORE the `Promise.all`. This way:
- Chats appear immediately after the API returns
- Enrichment and profile pics load in the background without blocking the UI
- The `finally` block becomes a safety net only

Specifically:
- After line 815 (`setChats([...parsed])`), add `setLoadingChats(false)`
- In the `else` branch (line 841), also add `setLoadingChats(false)` before `setChats(parsed)`
- Remove the `setLoadingChats(false)` from the `finally` block (or keep it as a fallback but ensure it doesn't cause issues)

This ensures chats render immediately while background enrichment happens asynchronously.

