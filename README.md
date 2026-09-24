# Auto Print

A print relay for cyber cafes and print shops. The customer scans the shop's QR
code, sends files from their own phone, pays, and the print comes out at the
counter. Nobody has to open WhatsApp, copy a file off a pen drive, or press
print — and the document is deleted the moment it has printed, from the server
and from the shop's computer.

There are three parts:

| Part | Where it runs | What it does |
| --- | --- | --- |
| Customer page | the customer's phone | pick files, choose copies and colour, see the price, pay, watch it print |
| Shop panel | the counter's browser | live queue, earnings, printer routing, rates, QR code |
| Print agent | the shop computer | claims paid jobs, prints them, deletes its copy |

## Run it locally

Requires Node 20 or newer.

```bash
npm install
npm run dev
```

The shop panel is on <http://localhost:47823>. On first run it creates a shop
with its own ID, agent token and API key, and stores everything under `.data/`.

Then start the agent on the machine your printer is attached to:

```bash
export AUTOPRINT_SERVER="http://localhost:47823"
export AUTOPRINT_TOKEN="<agent token from the QR & agent page>"
node agent/print-agent.mjs
```

The agent reports the printer queues it can see, so they appear in the panel on
their own — open **Printers** and tick which jobs each one handles (black &
white, colour, 4×6 photo, A3 and bigger).

No printer to hand? Two options:

- `node agent/print-agent.mjs --dry-run` runs the real loop, including the
  delete step, without putting anything on paper.
- **Virtual printer** on the queue page does the same thing server-side, so you
  can demo the flow with nothing installed.

### Trying the customer flow

Open **QR & agent** in the panel and scan the QR, or just open
`/print/<SHOP_ID>` in another tab. Upload a PDF or a photo, choose copies and
colour, and send it. The next screen follows the job all the way to *file
deleted from server and shop computer*.

For the QR to work on a real phone, the server has to be reachable from that
phone. Put it on the shop's network or behind a tunnel, then tell it the address
customers should use:

```bash
AUTOPRINT_PUBLIC_URL="https://print.myshop.in" npm run dev
```

## How a job flows

1. The customer uploads. Pages are counted, the price comes from the shop's own
   rates, and the job is routed to a printer that can do the work.
2. Payment settles — online, or the counter marks the cash collected. With
   **approve each job first** turned on, the counter also has to tap Approve.
3. The agent claims the job. Claiming happens inside a lock, so two computers
   can never print the same document.
4. The agent prints each file, deletes its temporary copy, and reports back.
5. The server deletes its copy immediately and records both deletions on the
   job, which is what the customer sees on their phone.

If a print fails, the job goes back in the queue until the shop's retry limit,
and the file is kept until then so it can be tried again. If the shop computer
dies mid-print, the job is requeued once the claim goes stale.

## Rates

Set per-page black & white and colour rates in **Settings**. On top of that:

- **Bulk rates** — from N sheets in one document, charge a lower rate.
- **Big paper** — separate A3, A2 and A1 rates; leave them at 0 and those sizes
  fall back to the normal rate.
- **Both sides** halves the sheet count, and so the price.

## Sending jobs from another website

If your site already takes the upload and the payment, post the document
straight into the queue with the shop's API key (**QR & agent** has ready-made
snippets):

```bash
curl -X POST http://localhost:47823/api/v1/print-jobs \
  -H "X-API-Key: <api key>" \
  -F "file=@invoice.pdf" \
  -F "copies=1" -F "color=bw" -F "paperSize=A4" \
  -F "customerName=Ravi" -F "paid=true"
```

JSON works too: send `documentUrl` or `fileBase64` instead of a file part. Poll
`GET /api/orders/<id>` for the status.

## API

Customer facing, no credentials:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/shop/:shopId` | shop name, rates, open or closed |
| `GET` | `/api/shop/:shopId/qr` | the counter QR, as SVG |
| `POST` | `/api/shop/:shopId/orders` | submit an order (multipart) |
| `GET` | `/api/orders/:id` | live status of one order |
| `POST` | `/api/orders/:id/pay` | confirm an online payment |

The shop computer, with `X-Agent-Token`:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/agent/heartbeat` | report version and visible printers |
| `POST` | `/api/agent/claim` | take queued jobs |
| `GET` | `/api/agent/jobs/:id/documents/:docId` | download a file to print |
| `POST` | `/api/agent/jobs/:id/result` | report the outcome |

Another website, with `X-API-Key`:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/print-jobs` | queue a job you already took payment for |

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `AUTOPRINT_PUBLIC_URL` | request host | address the QR code points at |
| `AUTOPRINT_DATA_DIR` | `./.data` | where the queue and files live |
| `AUTOPRINT_SHOP_ID` | generated | fix the shop ID instead of generating one |

Agent side:

| Variable | Default | Meaning |
| --- | --- | --- |
| `AUTOPRINT_SERVER` | `http://127.0.0.1:47823` | server to poll |
| `AUTOPRINT_TOKEN` | — | agent token, required |
| `AUTOPRINT_PRINTERS` | all found | comma separated queues to use |
| `AUTOPRINT_POLL_MS` | `3000` | how often to ask for work |

## What is not built yet

- **Payments are a stand-in.** `POST /api/orders/:id/pay` confirms without a
  gateway. Verify a Razorpay or Cashfree signature there and the rest of the
  flow is unchanged.
- **One shop per server.** The data model has a shop ID everywhere, but there is
  no login and no second shop.
- Passport photo sheets, the resume maker and mini-print (many pages on one
  sheet) are not implemented; the printer roles and rates leave room for them.

## Layout

```
agent/print-agent.mjs     the shop computer's agent, no dependencies
src/app/(owner)           shop panel: queue, printers, QR, settings
src/app/print/[shopId]    the customer's phone
src/app/api               customer, agent, panel and ingest endpoints
src/lib/store.ts          the queue: locking, routing, file deletion
src/lib/pricing.ts        rates, bulk tiers, sheet counting
```

Checks:

```bash
npm run typecheck
npm run lint
```
