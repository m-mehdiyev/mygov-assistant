// Front end. Talks to /api/chat — never to a model directly, and holds no key.

const LOGO = '<img src="/mygovaz_logo.jpeg" alt="mygov">';
// Supplied mygov logo is used for the assistant avatar.

const thread = document.getElementById('thread');
const status = document.getElementById('status');
const box    = document.getElementById('box');
const form   = document.getElementById('form');
const send   = document.getElementById('send');
document.getElementById('ava').innerHTML = LOGO;

let turns = [];
let busy  = false;

function now() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fmt(s) {
  return esc(s).replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');
}

function row(kind) {
  const r = document.createElement('div');
  r.className = 'row ' + kind;
  if (kind === 'in') {
    const m = document.createElement('div');
    m.className = 'mini';
    m.innerHTML = LOGO;
    r.appendChild(m);
  }
  const b = document.createElement('div');
  b.className = 'msg';
  r.appendChild(b);
  thread.appendChild(r);
  thread.scrollTop = thread.scrollHeight;
  return b;
}

function stamp(node, text, link) {
  node.innerHTML = fmt(text);
  if (link) {
    const a = document.createElement('a');
    a.className = 'golink';
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg><span>' +
      esc(link.label) + '</span>';
    node.appendChild(a);
  }
  const t = document.createElement('span');
  t.className = 'tstamp';
  t.textContent = now();
  node.appendChild(t);
  thread.scrollTop = thread.scrollHeight;
}

function typingOn() {
  status.textContent = 'typing…';
  const t = document.createElement('div');
  t.className = 'typing';
  t.id = 'ty';
  t.innerHTML = '<i></i><i></i><i></i>';
  thread.appendChild(t);
  thread.scrollTop = thread.scrollHeight;
}
function typingOff() {
  const t = document.getElementById('ty');
  if (t) t.remove();
  status.textContent = 'onlayn';
}

async function ask(text) {
  text = text.trim();
  if (busy || !text) return;
  busy = true;
  send.disabled = true;

  stamp(row('out'), text, null);
  turns.push({ role: 'user', content: text });
  if (turns.length > 14) turns = turns.slice(-14);

  typingOn();
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ turns }),
    });
    const data = await r.json().catch(() => ({}));
    typingOff();

    if (!r.ok) {
      const msg = {
        rate_limited: 'Çox qısa vaxtda çoxlu mesaj göndərildi. Bir az sonra yenidən cəhd edin.',
        server_not_configured: 'Assistant hələ tam konfiqurasiya edilməyib.',
        upstream_error: 'Hazırda assistant-a qoşulmaq mümkün olmadı. Yenidən cəhd edin.',
      }[data.error] || 'Xəta baş verdi. Yenidən cəhd edin.';
      stamp(row('in'), msg, null);
      return;
    }

    stamp(row('in'), data.text || '', data.link || null);
    turns.push({ role: 'assistant', content: data.text || '' });
  } catch (e) {
    typingOff();
    stamp(row('in'), 'Bağlantı kəsildi. İnternet bağlantınızı yoxlayıb yenidən cəhd edin.', null);
  } finally {
    typingOff();
    busy = false;
    send.disabled = false;
    box.focus();
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = box.value;
  box.value = '';
  ask(v);
});

stamp(
  row('in'),
  "Salam! Mən mygov Assistant-am.\n\nmygov və dövlət xidmətləri ilə bağlı suallarınızı sadə dildə verə bilərsiniz. Mövcud məlumatlara əsasən sizə qısa və aydın istiqamət verəcəyəm.\n\nMəsələn: “mygov nədir?” və ya “mygov-da nə edə bilərəm?”",
  null
);
box.focus();
