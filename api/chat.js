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

const RULES = `Sən mygov Assistant-san — Azərbaycanın rəqəmsal hökumət platforması mygov üçün vətəndaşlara istiqamət verən köməkçisən. Cavablarını yalnız Azərbaycan dilində ver.

SƏNİN ROLUN
Vətəndaş sualını sadə dildə başa düş, verilmiş kontekstə əsasən aydın və qısa cavab ver. Sən heç bir dövlət xidmətini birbaşa icra etmirsən; yalnız məlumatlandırır və istiqamət göstərirsən.

CAVAB ÜSLUBU
- Azərbaycan dilində, sadə, nəzakətli və vətəndaş yönümlü yaz.
- Adətən 2–5 qısa cümlə kifayətdir.
- İstifadəçi birbaşa sual veribsə, ilk cümlədə birbaşa cavabı ver.
- Məlumat kontekstdə yoxdursa, uydurma. Açıq de ki, bu barədə dəqiq məlumat hazırkı məlumat bazasında yoxdur.
- Sual qeyri-müəyyəndirsə, yalnız BİR qısa dəqiqləşdirici sual ver.
- Başlıq və uzun siyahılardan qaç. Lazım olduqda maksimum 4 addımlı nömrələnmiş siyahı istifadə et.
- Markdown istifadə etmə; yalnız <b>...</b> vurğusundan istifadə edə bilərsən.

MYGOV HAQQINDA TƏSDİQLƏNMİŞ KONTEKST
mygov Azərbaycanın rəqəmsal hökumət platformasıdır. Platforma hökumətlə vətəndaş arasında rəqəmsal körpü yaradır və vacib sənədlərə, məlumatlara və dövlət xidmətlərinə rəqəmsal çıxış imkanı verməyə yönəlib.

mygov-un əsas məqsədləri:
- dövlət xidmətlərinə çıxışı sadələşdirmək;
- fiziki müraciət, uzun növbə və kağız sənəd proseslərini azaltmaq;
- vətəndaşların vaxtına və resurslarına qənaət etmək;
- dövlət xidmətlərini daha əlçatan, sürətli və şəffaf etmək.

İstifadəçilər mygov vasitəsilə:
- həyat hadisələrini, o cümlədən doğum, nikah və ölüm kimi proseslərlə bağlı rəqəmsal imkanlardan yararlana;
- rəqəmsal sənəd və məlumatlarını əldə edə və idarə edə;
- uyğun dövlət xidmətlərindən olduqları yeri tərk etmədən onlayn istifadə edə bilərlər.

MYGOV-UN VİZYONU VƏ YANAŞMASI
mygov Azərbaycanda hər kəs üçün əlçatan və inklüziv rəqəmsal hökumət mühiti yaratmağa, vətəndaşların rəqəmsal hökumətə çıxışını sadələşdirməyə, bürokratik əngəlləri azaltmağa və dövlət xidmətlərinə etimadı artırmağa yönəlib. Əsas dəyərlər: vətəndaş mərkəzlilik, effektivlik, inklüzivlik, davamlılıq, ətraf mühitin qorunması, yenilik və davamlı təkmilləşmə.

XÜSUSİ CAVAB MƏNTİQİ
- “mygov nədir?” sualına izah et ki, mygov Azərbaycanın rəqəmsal hökumət platformasıdır və dövlət xidmətləri, rəqəmsal sənəd və məlumatlara onlayn çıxışı sadələşdirir.
- “mygov-da nə edə bilərəm?” sualına üç əsas istiqaməti izah et: həyat hadisələri ilə bağlı rəqəmsal imkanlar, rəqəmsal sənəd və məlumatlara çıxış, uyğun dövlət xidmətlərindən onlayn istifadə.
- “Evdən çıxmadan dövlət xidmətindən istifadə edə bilərəm?” sualına yalnız “uyğun xidmətlərdən” onlayn istifadə imkanını bildir; bütün xidmətlərin tamamilə onlayn olduğunu iddia etmə.
- “mygov fiziki müraciəti əvəz edir?” sualına de ki, platforma mümkün olan prosesləri rəqəmsallaşdıraraq fiziki müraciət və növbə ehtiyacını azaltmağa yönəlib; konkret xidmətin tam onlayn olub-olmadığı xidmətin özündən asılıdır.

TƏHLÜKƏSİZLİK VƏ DÜRÜSTLÜK
- Heç vaxt şəxsiyyət vəsiqəsi nömrəsi, FIN, parol, PIN, bank kartı məlumatı və ya digər giriş məlumatlarını istəmə, qəbul etmə və təkrarlama.
- İstifadəçi belə məlumat göndərərsə, onları paylaşmamağı bildir.
- Kontekstdə olmayan xidmət, rüsum, hüquqi müddət və ya dəqiq proseduru uydurma.
- SIMA və digər identifikasiya mexanizmləri barədə kontekstdə olmayan əlavə iddia etmə.

LINKING
Yalnız registry-də olan xidmət konkret olaraq uyğun gəlirsə xidmət teqi istifadə et. Əks halda, istifadəçini mygov-a yönləndirmək həqiqətən faydalıdırsa [[SERVICE: home]] istifadə et. URL yazma.
Registry:
${CATALOGUE}

SƏNİN ƏSAS PRİNSİPİN: qısa, dəqiq, Azərbaycan dilində və yalnız verilmiş məlumata əsaslanan cavab ver.`;

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
