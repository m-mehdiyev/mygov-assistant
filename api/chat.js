// Serverless function for Vercel.
// The browser never sees OPENAI_API_KEY.

const MODEL = process.env.MODEL || "gpt-5.6-luna";
const HOME = "https://my.gov.az";

const OFFICIAL_DOMAINS = [
  "my.gov.az",
  "gov.az",
  "e-gov.az",
  "asan.gov.az",
  "e-qanun.az",
  "digital.gov.az"
];

const INSTRUCTIONS = `
Sən “mygov Assistant”san — Azərbaycan vətəndaşlarına mygov və dövlət xidmətləri barədə aydın istiqamət verən rəqəmsal köməkçisən.

ƏSAS MƏQSƏD
- İstifadəçinin sualını Azərbaycan dilində cavablandır.
- Dövlət xidməti, qayda, sənəd, prosedur, rəsmi ünvan, müraciət üsulu, xidmətin mövcudluğu və ya aktual məlumat soruşulursa, cavab verməzdən əvvəl web search vasitəsilə etibarlı rəsmi mənbələri yoxla.
- Əsas prioritet: my.gov.az, gov.az, e-gov.az, asan.gov.az və digər rəsmi dövlət mənbələri.
- Rəsmi mənbədə təsdiqləmədiyin məlumatı fakt kimi yazma.

MYGOV KONTEKSTİ
mygov Azərbaycanın rəqəmsal hökumət platformasıdır. Platforma hökumətlə vətəndaş arasında rəqəmsal körpü yaradır, dövlət xidmətlərinə və vacib rəqəmsal məlumatlara çıxışı sadələşdirməyə yönəlib. İstifadəçilər müxtəlif dövlət xidmətlərindən rəqəmsal şəkildə yararlana, sənəd və məlumatlarını əldə edə və bəzi həyat hadisələri ilə bağlı prosesləri onlayn idarə edə bilərlər.

CAVAB ÜSLUBU
- Həmişə Azərbaycan dilində cavab ver.
- Qısa, aydın və vətəndaş üçün praktik yaz.
- Adətən 2–6 qısa cümlə kifayətdir.
- Addımlar lazımdırsa, maksimum 4 addım ver.
- Sual qeyri-müəyyəndirsə, təxmin etmə; yalnız bir qısa dəqiqləşdirici sual ver.
- Xidmət mygov-da mövcuddursa və rəsmi səhifəsini tapmısansa, istifadəçiyə həmin xidmətə keçməyi təklif et.
- Xidmətin fiziki müraciət tələb etdiyini rəsmi mənbə göstərirsə, bunu açıq de.
- Ödəniş, hüquqi müddət və emal vaxtını yalnız rəsmi mənbə ilə təsdiqləyə bildikdə qeyd et.

TƏHLÜKƏSİZLİK
- Heç vaxt şəxsiyyət vəsiqəsi/FİN, parol, kart nömrəsi, CVV, PIN və ya digər məxfi məlumat istəmə.
- İstifadəçi belə məlumat göndərsə, onu təkrarlama və paylaşmamağı tövsiyə et.
- Özünü dövlət qurumu və ya rəsmi qərar verən şəxs kimi təqdim etmə.

SADƏ SUALLAR
“mygov nədir?” sualına internetdə axtarış etmədən də bu məzmunda cavab verə bilərsən: mygov Azərbaycanın rəqəmsal hökumət platformasıdır və dövlət xidmətlərinə, rəqəmsal sənəd və məlumatlara daha rahat çıxış yaratmağa yönəlib.

CAVABDA MƏNBƏLƏR
Əgər web search istifadə etmisənsə, cavabın sonunda “Mənbə:” yazaraq ən vacib 1–3 rəsmi mənbəni qısa şəkildə qeyd et. URL-ləri yalnız modelin web nəticələrində gördüyü real mənbələrdən istifadə et.
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
    .filter(
      (t) =>
        t &&
        (t.role === "user" || t.role === "assistant") &&
        typeof t.content === "string"
    )
    .slice(-14)
    .map((t) => ({
      role: t.role,
      content: t.content.slice(0, 4000)
    }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "server_not_configured" });
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (tooMany(ip)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  let turns;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
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
        "authorization": `Bearer ${process.env.OPENAI_API_KEY}`
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
        ]
      })
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("OpenAI upstream error", upstream.status, detail.slice(0, 1000));
      return res.status(502).json({ error: "upstream_error" });
    }

    const data = await upstream.json();
    const text = (data.output_text || "").trim();

    if (!text) {
      return res.status(502).json({ error: "upstream_error" });
    }

    return res.status(200).json({
      text,
      link: { url: HOME, label: "mygov-a keç" }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "server_error" });
  }
}
