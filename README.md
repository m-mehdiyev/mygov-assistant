# mygov Assistant — OpenAI Web Search versiyası

Bu versiyada assistant istifadəçi suallarını OpenAI Responses API vasitəsilə cavablandırır və dövlət xidməti ilə bağlı aktual məlumat lazım olduqda web search istifadə edir.

## Necə işləyir

`browser -> /api/chat -> OpenAI Responses API + web search -> cavab`

API açarı yalnız Vercel server tərəfində saxlanılır və brauzerə göndərilmir.

## Vercel quraşdırılması

Vercel → Project → Settings → Environment Variables bölməsində:

| Name | Value |
|---|---|
| `OPENAI_API_KEY` | OpenAI API açarınız |
| `MODEL` | optional; default `gpt-5.6-luna` |

Sonra **Redeploy** edin.

## Vacib

- `OPENAI_API_KEY`-ni GitHub-a yükləməyin.
- API açarını heç kimlə paylaşmayın.
- Assistant rəsmi dövlət mənbələrinə üstünlük vermək üçün konfiqurasiya olunub.
- `api/chat.js` faylında cavab məntiqi və web search domenləri dəyişdirilə bilər.
