# Troubleshooting

## Production: Page won’t load / “Cookie __cf_bm rejected” / WebSocket / CORS errors

If you see in the browser console:

- **Cookie “__cf_bm” has been rejected for invalid domain**
- **WebSocket connection to `wss://...supabase.co/realtime/...` interrupted**
- **CORS request did not succeed** (with status `null`) when calling Supabase REST

these often happen together when the network or proxy (e.g. Cloudflare) blocks or misconfigures connections to Supabase.

### What the app does to cope

- **Auth init timeout (12s):** If restoring the session or loading the profile hangs (e.g. Supabase unreachable), the app stops waiting after 12 seconds and shows the login screen so the page is still usable.
- **Realtime:** WebSocket/realtime failures are handled so they don’t crash the UI. The app keeps working with normal REST; live updates may stop until the connection is healthy again.

### What you should check (infra / deployment)

1. **Cookie domain (`__cf_bm`)**  
   `__cf_bm` is set by Cloudflare Bot Management. “Invalid domain” usually means the site is being opened on a host that doesn’t match your Cloudflare config (e.g. by IP, different subdomain, or wrong domain). Fix by:
   - Using the **exact domain** you configured in Cloudflare (and in Supabase “Site URL” / allowed redirect URLs), and
   - Making sure that domain is what users actually use (no mixed IP/domain, correct subdomain).

2. **Supabase connectivity**  
   From the same network as your users, confirm:
   - REST: `https://<project>.supabase.co/rest/v1/` is reachable.
   - Realtime: `wss://<project>.supabase.co/realtime/v1/websocket` is allowed (no firewall/proxy blocking WebSockets).

3. **CORS**  
   In Supabase Dashboard → Project Settings → API, ensure your **production origin** (e.g. `https://your-app.example.com`) is allowed.  
   If the browser shows “CORS request did not succeed” with **status (null)**, the request often never reached the server (network/connection failure); fixing connectivity and cookie/domain usually resolves it.

After fixing domain/proxy/firewall, do a hard refresh or reopen the app; the page should load and, once connectivity is stable, realtime should work again.
