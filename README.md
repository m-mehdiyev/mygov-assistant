# mygov Assistant — Final

Bu versiya:
- yeni iPhone tipli müasir dizayn;
- mygov loqosu;
- Azərbaycan dilində interfeys;
- OpenAI Responses API;
- rəsmi mənbələrə məhdudlaşdırılmış Web Search;
- Vercel Serverless Function dəstəyi ilə hazırlanıb.

## Vercel Environment Variable

Project Settings → Environment Variables bölməsində:

- `OPENAI_API_KEY` — OpenAI secret key
- `MODEL` — opsional; standart `gpt-5.6-luna`

API key heç vaxt GitHub-a əlavə edilməməlidir.

## Deploy

Faylları GitHub repository-yə yüklə. Vercel Git repository-yə bağlıdırsa, yeni commit-dən sonra avtomatik deployment başlayacaq. Environment variable əlavə etdikdən sonra yeni deployment / redeploy et.
