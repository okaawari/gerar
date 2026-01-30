# Testing QPay payment callbacks locally

When you run the API on your machine, QPay cannot reach `localhost`. It will call whatever URL is in `QPAY_CALLBACK_BASE_URL`. If that is `https://api.gerar.mn/api`, the callback goes to production and you see **no logs and no email** on your PC.

To get callbacks (and payment confirmation emails) on your local run:

## 1. Expose your local server with a tunnel

### Option A: ngrok (recommended)

1. Install: [ngrok](https://ngrok.com/download) or `npm install -g ngrok`
2. Start your API: `npm run dev` (port 3000)
3. In another terminal: `ngrok http 3000`
4. Copy the **HTTPS** URL ngrok shows (e.g. `https://abc123.ngrok-free.app`)

### Option B: Cloudflare Tunnel

```bash
# Install cloudflared, then:
cloudflared tunnel --url http://localhost:3000
```

Use the generated `*.trycloudflare.com` URL.

## 2. Point QPay to your tunnel

In your **.env** (for this local session), set:

```env
# Use your tunnel URL + /api (no trailing slash)
QPAY_CALLBACK_BASE_URL=https://YOUR-NGROK-URL.ngrok-free.app/api
```

Example: if ngrok gives `https://abc123.ngrok-free.app`, then:

```env
QPAY_CALLBACK_BASE_URL=https://abc123.ngrok-free.app/api
```

## 3. Restart the API

Restart your Node server so it reads the new `.env`. Then create an order and pay with QPay. You should see:

- `[QPAY] Payment callback hit – orderId: ...` in your terminal
- Payment confirmation email in the customer’s inbox

**Note:** Free ngrok URLs change each time you run `ngrok http 3000`. Update `QPAY_CALLBACK_BASE_URL` in `.env` whenever the URL changes, and **do not commit** that local `.env` value.
