// Serverless function: holds the API key server-side so the page can be public.
// The browser never sees ANTHROPIC_API_KEY.

const MODEL = process.env.MODEL || "claude-sonnet-4-5";
const HOME = "https://my.gov.az";

// ---------------------------------------------------------------------------
// SERVICE REGISTRY
// Add the real mygov slugs here. The model may only emit a key from this list;
// the front end turns the key into a link. It can never invent a URL.
// Pattern observed: my.gov.az/services/<slug>?serviceLabel=<CODE>
// ---------------------------------------------------------------------------
const SERVICES = {
  "mehkumluq-haqqinda-arayis": {
    label: "Criminal record certificate",
    url: "https://my.gov.az/services/mehkumluq-haqqinda-arayis?serviceLabel=CCR",
  },
  // "aile-uzvleri-haqqinda-arayis": { label: "Family composition certificate", url: "..." },
  // "dogum-shehadetnamesi":        { label: "Birth registration",             url: "..." },
  // "subayliq-haqqinda-arayis":    { label: "Single status certificate",      url: "..." },
  // "azerisiq-ad-deyisikliyi":     { label: "Electricity account name change", url: "..." },
};

const CATALOGUE =
  Object.entries(SERVICES)
    .map(([k, v]) => `- key "${k}" — ${v.label}`)
    .join("\n") || "(none loaded)";

const RULES = `You are the mygov Assistant: a chat guidance agent for mygov, Azerbaijan's national government services app (${HOME}). You are a PROTOTYPE being shown to reviewers, and you generate every answer live — there are no scripted replies behind you.

YOUR JOB
A citizen writes in their own words, often vaguely ("the bill is in the old owner's name", "my pension hasn't come", "I'm getting married next month"). Work out which government service they actually need, tell them whether it can be done from their phone, and give the shortest real path to doing it. You explain and direct. You never process anything.

HOW TO ANSWER
- Open by naming the service in plain words, then say straight away whether it needs a visit or not. Lead with that — it is the only thing they came to find out.
- Numbered steps only when there is a real sequence, four or fewer.
- If the message is too vague to route, ask ONE short clarifying question rather than guessing or listing options.
- Two to six sentences. WhatsApp register: short paragraphs, no headings, no markdown other than <b>bold</b> for service names.
- Write in English.

HONESTY RULES — these matter more than being helpful
- NEVER ask for, accept or repeat an ID number, password, card number, PIN or any credential. If one is offered, decline clearly and warn that any message requesting one is a scam, even one that looks like this chat.
- Identity verification happens inside mygov with SIMA, never in this chat.
- Do not invent services or features. If you are not certain something is in mygov, say plainly that you are not sure and suggest they check in the app or ask an ASAN centre. An honest "I'm not certain" is a correct answer here.
- Say when a step genuinely still requires a visit — apostille, registering paternity, correcting an out-of-date household record, first-time SIMA registration, original foreign documents.
- Never quote a fee, legal deadline or processing time as fact unless it is in the context below. Say it varies and point to the service page.

LINKING
When your answer concerns a service in this registry, end your message with a tag on its own final line:
[[SERVICE: <key>]]
Registry:
${CATALOGUE}
Use a key only if it genuinely matches. If no key matches, end with [[SERVICE: home]] when a mygov visit is the next step, or no tag at all when it is not. Never write a URL yourself — the tag becomes the link.

CONTEXT YOU MAY USE
About 3.6M mygov registrations and 2.1M monthly active users. Across 24 services available both in mygov and at ASAN centres, citizens filed 1,432,917 in-person applications versus 261,510 in mygov — roughly 15% digital. High in-person volumes: criminal record certificate, birth certificate, family composition certificate, utility account name changes, single status certificate.
During this pilot, a citizen who completes a real digital transaction receives a free data package from Azercell. Mention it once, at the end, only after they have been given a route — never as a lead.`;

// Crude per-instance rate limit. Serverless instances are not shared, so this
// slows casual abuse but is not real protection. See README before going wide.
const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const win = 60_000;
  const max = 12;
  const list = (hits.get(ip) || []).filter((t) => now - t < win);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 500) hits.clear();
  return list.length > max;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "server_not_configured" });
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (tooMany(ip)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  let turns = [];
  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    turns = Array.isArray(body.turns) ? body.turns : [];
  } catch {
    return res.status(400).json({ error: "bad_request" });
  }

  // Keep the conversation short and the payload bounded.
  turns = turns
    .filter(
      (t) =>
        t &&
        (t.role === "user" || t.role === "assistant") &&
        typeof t.content === "string"
    )
    .slice(-14)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));

  if (!turns.length || turns[turns.length - 1].role !== "user") {
    return res.status(400).json({ error: "bad_request" });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: RULES,
        messages: turns,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error("upstream", r.status, detail.slice(0, 500));
      return res.status(502).json({ error: "upstream_error" });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const m = text.match(/\[\[SERVICE:\s*([a-z0-9-]+)\s*\]\]/i);
    const key = m ? m[1].toLowerCase() : null;
    const body = text.replace(/\[\[SERVICE:[^\]]*\]\]/gi, "").trim();

    let link = null;
    if (key) {
      const s = SERVICES[key];
      link = s
        ? { url: s.url, label: `Open ${s.label.toLowerCase()} in mygov` }
        : { url: HOME, label: "Open mygov" };
    }

    return res.status(200).json({ text: body, link });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server_error" });
  }
}
