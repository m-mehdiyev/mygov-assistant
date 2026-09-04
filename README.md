# mygov Assistant — deployable prototype

A public, shareable version of the mygov guidance assistant. Anyone can open the
link and use it — no account, no sign-in, nothing to install.

## Why this exists

The claude.ai artifact version cannot be shared publicly, because it runs on each
viewer's own Claude account. This version keeps the API key on the server, so the
page itself can be fully public. That is the same pattern every public AI demo on
Vercel uses.

```
browser  ──POST /api/chat──▶  serverless function  ──▶  model API
(no key)                      (holds the key)
```

## Deploy in about ten minutes

1. **Get an API key** — console.anthropic.com → API keys. Set a monthly spend
   limit on the account while you are there; the link will be public.

2. **Put these files in a Git repo** (GitHub, GitLab). Keep the structure:

   ```
   index.html
   app.js
   favicon.svg
   api/chat.js
   package.json
   ```

3. **Import the repo at vercel.com** → New Project → Import. No build settings to
   change; Vercel serves the static files and treats `api/chat.js` as a function
   automatically.

4. **Add the environment variable** in Vercel → Settings → Environment Variables:

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your key |
   | `MODEL` | current model id (optional — see below) |

5. **Deploy.** You get a public `*.vercel.app` URL. Add a custom domain in
   Settings → Domains when you want a mygov or IDDA address.

Local development: `npx vercel dev` with a `.env.local` (copy `.env.example`).

## Confirm the model id before launch

`api/chat.js` defaults to `claude-sonnet-4-5`. Model identifiers change over time —
check the current list at https://docs.claude.com/en/docs/about-claude/models and
set the `MODEL` environment variable accordingly. If the function returns
`upstream_error`, a wrong model id is the first thing to check (the real reason is
in the Vercel function logs).

## Three things to finish

**1. Service deep links.** `api/chat.js` has a `SERVICES` registry. Only one entry
is filled in — the criminal record certificate, verified. The commented lines
below it are placeholders with guessed slugs; replace them with the real ones.

The URL pattern is:

```
https://my.gov.az/services/<slug>?serviceLabel=<CODE>
```

The model can only emit a registry key, never a URL, so it cannot invent a link.
Anything not in the registry falls back to the mygov home page.

**2. The logo.** `app.js` starts with a `LOGO` constant holding a placeholder
wordmark. Replace it with the real mygov SVG, or drop `logo.svg` in the project
root and swap the `.ava` / `.mini` contents for `<img src="/logo.svg" alt="mygov">`.

**3. The link preview image.** `index.html` points `og:image` at `/preview.png`.
Add a 1200×630 PNG at the project root and WhatsApp, Telegram and Slack will show
it with the title "mygov Assistant" instead of a generic card.

## Before you share it widely

The rate limit in `api/chat.js` counts requests per IP inside a single serverless
instance. Instances are not shared, so it slows casual abuse and nothing more. A
public link with a real API key behind it needs at least:

- a spend limit on the API account (do this first, it takes one minute)
- a shared rate-limit store — Vercel KV or Upstash — if the link goes beyond a
  demo audience
- a look at the Vercel function logs after the first day

For a mentor presentation and a handful of colleagues, the spend limit alone is
enough.

## Pointing it at your own model

To run on internal infrastructure instead of a commercial API, change one `fetch`
in `api/chat.js` — the URL, the auth header, and the response shape it reads. The
system prompt, the service registry, the tag parsing and the entire front end stay
as they are.

## Files

| File | What it does |
|---|---|
| `index.html` | Page shell, styles, link-preview tags |
| `app.js` | Chat UI. Calls `/api/chat`. Holds no key |
| `api/chat.js` | Server function: system prompt, service registry, model call |
| `favicon.svg` | Placeholder tab icon |

The assistant's behaviour — how it routes a vague request, when it admits
something still needs a visit, its refusal to touch credentials — all lives in the
`RULES` string in `api/chat.js`. That is the file to edit to change how it talks.
