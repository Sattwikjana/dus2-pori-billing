<div align="center">
  <img src="public/logo.png" alt="Dus2 PORI" width="260" />

  ### Billing, inventory & loyalty for the Dus2 PORI cosmetics store
  Free to run. Free to host. No monthly fee, no per-bill charge, no account.
</div>

---

## What it does

The point of the app is the **customer book**: who buys, how much they have spent
over their lifetime, and how many points they hold. Billing is how that record
gets captured.

| | |
|---|---|
| 📱 **Instant customer lookup** | Type the **last 4–5 digits** of a mobile number and matching customers appear as you type. Tap one and every detail fills in — name, phone, points, past visits, lifetime spend |
| 👤 **Customer book** | Lifetime spend, visit count, last visit, birthday and a full points ledger for every customer |
| ⭐ **Loyalty points** | Earn on every bill, redeem against future ones. You set the rules |
| 🎟️ **Referrals** | Every customer gets a shareable code. When a friend joins with it, both get points — and the referrer can also earn a percentage of that friend's first bill |
| 🧾 **Billing** | Build a bill in seconds, print it, or send it on WhatsApp |
| 📦 **Products & stock** | Stock drops automatically with each sale, with low-stock and out-of-stock alerts |
| 📓 **Khata / Udhaar** | Track who still owes you, and send a polite WhatsApp reminder in one tap |
| 💸 **Expenses** | Rent, stock, salary, electricity — so reports show what you actually earned |
| 📊 **Reports** | Daily sales, best sellers, top customers, payment-mode split, CSV export |
| 🎂 **Birthday offers** | See whose birthday falls this month and message them |
| 🧮 **Points ledger** | Every point earned, redeemed, referred or hand-adjusted is logged, so a balance can always be explained |
| 📄 **One-click PDF** | Download or share a proper A4 invoice with your logo |

## How the rewards work

All of it is adjustable under **Loyalty**, and changes apply to new bills.

**Loyalty points**

- Points for every ₹100 spent (default 5)
- What one point is worth when redeemed (default ₹1)
- Minimum balance before a customer can spend points (default 50)

**Referrals**

- Points to the referrer when someone uses their code (default 50)
- Welcome points to the friend who used it (default 25)
- A percentage of the friend's **first** bill, credited to the referrer as
  points (default 5%) — paid once, on that first purchase

A customer's code looks like `PRIY119`: the first letters of their name plus a
number derived from their record, so it stays the same for life and is easy to
read out over the counter. Open a customer to copy it or send it on WhatsApp.

## Where your data lives

Everything — customers, points, bills, products, expenses — is stored in a
**free Postgres database**, and mirrored onto whatever device you are using.

That mirror is what makes it work in a real shop:

- **Bill without internet.** Everything saves to the device instantly. Nothing
  waits on a network round-trip, and a dropped connection never blocks a sale.
- **It uploads itself.** The moment the connection returns, queued changes go
  up. The sidebar says `Saved to cloud`, `Saving…` or `Offline` so you always
  know where you stand.
- **Any device, same data.** Open the site on the shop computer and your phone
  and both show the same customers and points.
- **A wiped phone loses nothing.** Sign in on a new device and everything
  comes back down.

Only what changed is exchanged, so sync stays quick after years of bills.

> [!TIP]
> Still download a backup now and then (*Settings → Download backup*). The
> cloud copy protects against a lost phone; a backup file protects against
> data deleted by accident.

> [!WARNING]
> Avoid billing on two devices at the *same moment* — both would hand out the
> same invoice number. Using them at different times is completely fine.

## Setting up the database

On Vercel: open your project → **Storage** → **Create Database** → **Neon**.
Vercel injects `DATABASE_URL` for you; redeploy and *Settings* will show
"Your data is saved in the cloud". Neon's free tier is far more than this shop
will ever need, and no card is required.

Leave `DATABASE_URL` unset and the app still runs — it just keeps everything on
the one device, and says so.

Any other Postgres works too (the app uses Neon's HTTP driver for `.neon.tech`
hosts and a normal pooled connection otherwise), so you are not locked in.

## Login

The whole site sits behind one username and password, checked on the server before any page loads.

Set these in **Vercel → your project → Settings → Environment Variables**:

| Variable | What it is |
|---|---|
| `SHOP_USERNAME` | The username you sign in with |
| `SHOP_PASSWORD` | The password you sign in with — make it long |
| `AUTH_SECRET` | Any long random string; signs the login cookie |
| `DATABASE_URL` | Added automatically by the Vercel Neon integration |

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

Leave `DATABASE_URL` empty to run against device storage only, or point it at
any Postgres to test syncing.

## Deploying to Vercel

1. Push this repository to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Add the environment variables above.
4. Under **Storage**, create a Neon database — `DATABASE_URL` is wired up for you.
5. Deploy. Vercel's Hobby plan and Neon's free tier cover this shop at no cost.

## If a deployment says "Blocked"

Vercel's Hobby plan does not allow outside contributors on a private
repository, and it decides who the contributor is from the **commit author
email**. If you commit from a machine whose git identity is some other address,
Vercel treats the push as coming from a stranger and blocks the build before it
starts.

Check what a machine is committing as:

```bash
git config user.email
```

It must be an email verified on the GitHub account that owns this repository
(`sattwikjana77@gmail.com`). Fix it for this repository with:

```bash
git config user.email "sattwikjana77@gmail.com"
```

Commits already pushed under the wrong address stay blocked, but a new commit
with the right one deploys normally and carries all the earlier work with it.

## Installing it on a phone

Open the site in Chrome on Android → menu → **Add to Home screen**. It then opens like a normal app, full screen, and works offline.

## Built with

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Postgres (Neon) · jsPDF

---

<div align="center"><sub>Made for Dus2 PORI 💜</sub></div>
