<div align="center">
  <img src="public/logo.png" alt="Dus2 PORI" width="260" />

  ### Billing, inventory & loyalty for the Dus2 PORI cosmetics store
  Free to run. Free to host. No monthly fee, no per-bill charge, no account.
</div>

---

## What it does

| | |
|---|---|
| 🧾 **Billing** | Build a bill in seconds, print it, or send it on WhatsApp |
| 📱 **Instant customer lookup** | Type the **last 4–5 digits** of a mobile number and a returning customer appears with their name, points, visits and lifetime spend — every detail auto-fills |
| ⭐ **Loyalty points** | Earn on every bill, redeem against future ones. You set the rules |
| 📦 **Products & stock** | Stock drops automatically with each sale, with low-stock and out-of-stock alerts |
| 📓 **Khata / Udhaar** | Track who still owes you, and send a polite WhatsApp reminder in one tap |
| 💸 **Expenses** | Rent, stock, salary, electricity — so reports show what you actually earned |
| 📊 **Reports** | Daily sales, best sellers, top customers, payment-mode split, CSV export |
| 🎂 **Birthday offers** | See whose birthday falls this month and message them |
| 📄 **One-click PDF** | Download or share a proper A4 invoice with your logo |

## Where your data lives

Everything — bills, customers, products, expenses — is stored **in the browser on your device**. Nothing is uploaded to any server, so there is no database to pay for and the app keeps working without internet once loaded.

> [!IMPORTANT]
> Because the data is on your device, **take a backup every week**: *Settings → Download backup*. Save that file to Google Drive or WhatsApp it to yourself. If the browser data is cleared or you switch phones, that file is the only way to restore your bills. Restore with *Settings → Restore backup*.

## Login

The whole site sits behind one username and password, checked on the server before any page loads.

Set these in **Vercel → your project → Settings → Environment Variables**:

| Variable | What it is |
|---|---|
| `SHOP_USERNAME` | The username you sign in with |
| `SHOP_PASSWORD` | The password you sign in with — make it long |
| `AUTH_SECRET` | Any long random string; signs the login cookie |

Generate a secret with:

```bash
openssl rand -base64 32
```

> [!WARNING]
> If you don't set `SHOP_USERNAME` and `SHOP_PASSWORD`, the app falls back to built-in defaults that are public in this repository. Set your own before you share the link with anyone.

Redeploy after changing them. Changing the password signs everyone out.

## Running it on your own computer

```bash
npm install
cp .env.example .env.local   # then edit .env.local
npm run dev
```

Open http://localhost:3000

## Deploying to Vercel

1. Push this repository to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Add the three environment variables above.
4. Deploy. The free Hobby plan is enough — there is no database and no backend cost.

## Installing it on a phone

Open the site in Chrome on Android → menu → **Add to Home screen**. It then opens like a normal app, full screen, and works offline.

## Built with

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · jsPDF

---

<div align="center"><sub>Made for Dus2 PORI 💜</sub></div>
