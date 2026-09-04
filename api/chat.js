// Vercel Serverless Function
// OPENAI_API_KEY stays only on the server and is never sent to the browser.

const MODEL = process.env.MODEL || "gpt-5.6-luna";
const HOME = "https://my.gov.az";

// Restrict web search to official Azerbaijani government / mygov sources.
const OFFICIAL_DOMAINS = [
  "my.gov.az",
  "gov.az",
  "e-gov.az",
  "asan.gov.az",
  "e-qanun.az",
  "digital.gov.az"
];

const INSTRUCTIONS = `
Sən “mygov Assistant”san — Azərbaycan vətəndaşlarına mygov və dövlət xidmətləri barədə aydın, praktik və etibarlı istiqamət verən rəqəmsal köməkçisən.

DİL VƏ ÜSLUB
- Həmişə Azərbaycan dilində cavab ver.
- Cavablar qısa, aydın və praktik olsun.
- Adətən 2–6 qısa cümlə kifayətdir.
- Addımlar lazımdırsa, maksimum 4 addım ver.
- İstifadəçi qeyri-müəyyən sual verərsə, təxmin etmə; bir qısa dəqiqləşdirici sual ver.

MYGOV HAQQINDA ƏSAS MƏLUMAT
mygov Azərbaycanın rəqəmsal hökumət platformasıdır. Platforma hökumətlə vətəndaş arasında rəqəmsal körpü yaradır, dövlət xidmətlərinə və vacib rəqəmsal məlumatlara çıxışı sadələşdirməyə yönəlib. İstifadəçilər müxtəlif dövlət xidmətlərindən rəqəmsal şəkildə yararlana, sənəd və məlumatlarını əldə edə və bəzi həyat hadisələri ilə bağlı prosesləri onlayn idarə edə bilərlər.

RƏSMİ MƏLUMAT VƏ WEB SEARCH
- Dövlət xidməti, qayda, sənəd, prosedur, rəsmi ünvan, müraciət üsulu, xidmətin mövcudluğu, ödəniş, müddət və ya digər aktual məlumat soruşulursa, cavab verməzdən əvvəl web search istifadə et.
- Axtarış yalnız etibarlı rəsmi mənbələrdə aparılır: my.gov.az, gov.az, e-gov.az, asan.gov.az, e-qanun.az və digital.gov.az.
- Rəsmi mənbədə təsdiqləmədiyin məlumatı fakt kimi yazma.
- Rəsmi mənbədə xidmətin mygov-da olub-olmadığı təsdiqlənirsə, bunu açıq yaz.
- Fiziki müraciət tələb olunursa, bunu açıq bildir.
- Ödəniş, hüquqi müddət və emal vaxtını yalnız rəsmi mənbə ilə təsdiqlədikdə qeyd et.

SADƏ SUALLAR
- “mygov nədir?” sualına belə cavab verə bilərsən: “mygov Azərbaycanın rəqəmsal hökumət platformasıdır. Platforma dövlət xidmətlərinə, rəqəmsal sənəd və məlumatlara daha rahat çıxış yaratmağa yönəlib.”

TƏHLÜKƏSİZLİK
- Heç vaxt şəxsiyyət vəsiqəsi/FİN, parol, kart nömrəsi, CVV, PIN və digər məxfi məlumatları istəmə.
- İstifadəçi belə məlumat paylaşarsa, onu təkrarlama və paylaşmamağı tövsiyə et.
- Özünü dövlət qurumu və ya rəsmi qərar verən şəxs kimi təqdim etmə.

MƏNBƏLƏR
- Web search istifadə etmisənsə, cavabın sonunda “Mənbə:” bölməsi əlavə et və ən vacib 1–3 rəsmi mənbəni qısa şəkildə göstər.
- Yalnız axtarış nəticələrində gördüyün real mənbələrdən istifadə et.
`;

const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 12;
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 500) hits.clear();
  return list.length > max;
}

function normaliseTurns(turns) {
  return turns
    .filter((t) =>
      t &&
      (t.role === "user" || t.role === "assistant") &&
      typeof t.content === "string"
    )
    .slice(-14)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "server_not_configured" });
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (tooMany(ip)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  let turns;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    turns = normaliseTurns(Array.isArray(body.turns) ? body.turns : []);
  } catch {
    return res.status(400).json({ error: "bad_request" });
  }

  if (!turns.length || turns[turns.length - 1].role !== "user") {
    return res.status(400).json({ error: "bad_request" });
  }

  try {
    const input = [
      { role: "developer", content: INSTRUCTIONS },
      ...turns.map((t) => ({ role: t.role, content: t.content }))
    ];

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        input,
        max_output_tokens: 700,
        tools: [
          {
            type: "web_search",
            filters: { allowed_domains: OFFICIAL_DOMAINS },
            search_context_size: "medium"
          }
        ],
        tool_choice: "auto"
      })
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("OpenAI upstream error", upstream.status, detail.slice(0, 1000));
      return res.status(502).json({ error: "upstream_error" });
    }

    const data = await upstream.json();

    // `output_text` is an SDK convenience field and is not guaranteed in raw REST JSON.
    // Extract assistant text from the Responses API output array.
    const text = (Array.isArray(data.output) ? data.output : [])
      .filter((item) => item && item.type === "message" && item.role === "assistant")
      .flatMap((item) => Array.isArray(item.content) ? item.content : [])
      .filter((part) => part && part.type === "output_text")
      .map((part) => part.text || "")
      .join("")
      .trim();

    if (!text) {
      console.error("OpenAI returned no assistant text", JSON.stringify(data).slice(0, 2000));
      return res.status(502).json({ error: "upstream_error" });
    }

    return res.status(200).json({
      text,
      link: { url: HOME, label: "mygov-a keç" }
    });
  } catch (error) {
    console.error("Server error", error);
    return res.status(500).json({ error: "server_error" });
  }
}
