# Project Instructions

## Mobile View Setup

**Whenever the user asks about mobile view, mobile UI, mobile frontend, or any UI/frontend changes:**

Before making or reviewing changes, set up the accurate mobile preview in Chrome:

1. Navigate to: `http://localhost:5173/user-details/aa115461-172a-404a-b20d-7def4ee57a74`
2. Set the viewport to **iPhone 14 Pro Max — 430 × 932px** using Chrome DevTools device emulation

This ensures what you see in the browser exactly matches the real phone screen.

Claude handles this fully automatically using the Chrome MCP:
- `mcp__Claude_in_Chrome__navigate` → navigates to the URL above
- `mcp__Claude_in_Chrome__resize_window` → resizes to 430×932 (no manual DevTools needed)
- `mcp__computer-use__screenshot` → captures the view to confirm before/after changes

> **Note:** If the DevTools console panel opens on the right, press **Cmd+Option+I** to close it for a clean full-width view.

> The dev server runs at `http://localhost:5173`. The test employee used for mobile preview is user ID `aa115461-172a-404a-b20d-7def4ee57a74` (displayed name: 3test).

## Demo Credentials (Realistic Data)

Use these credentials when logging in to test with realistic data:

- **Email:** `anas.aljanaby667@gmail.com`
- **Password:** `ChangeMe123!`
