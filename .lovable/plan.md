

## Problem

The "Assinar" flow has two issues with `window.open`:

1. **PlanosPage auto-checkout**: After login/signup with `?plan=X`, the user is redirected to `/planos?selected=pro`. The auto-checkout runs in a `useEffect`, calling `window.open` -- this is **blocked by popup blockers** because it's not triggered by a direct user click.

2. **LandingPage buttons**: Uses `window.open(url, '_blank')` which may also be blocked in certain contexts (iframe preview, strict popup blockers).

## Fix

Replace `window.open(url, '_blank')` with `window.location.href = url` in both places. This navigates the current tab directly to the Cakto checkout page instead of opening a popup, which is never blocked.

### Changes

1. **`src/pages/PlanosPage.tsx`** (line 78): Change `window.open(plan.caktoUrl, '_blank')` to `window.location.href = plan.caktoUrl`

2. **`src/pages/LandingPage.tsx`** (line 432): Change `window.open(plan.checkoutUrl, '_blank')` to `window.location.href = plan.checkoutUrl`

