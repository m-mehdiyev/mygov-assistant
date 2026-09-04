// Front end. Talks to /api/chat — never to a model directly, and holds no key.

const LOGO = '<svg viewBox="0 0 64 64" role="img" aria-label="mygov"><rect width="64" height="64" rx="14" fill="#0B6FA4"/><text x="32" y="39" font-family="Archivo,Arial,sans-serif" font-size="19" font-weight="700" fill="#fff" text-anchor="middle" letter-spacing="-0.5">mygov</text></svg>';
// ^ Placeholder wordmark. Replace this whole string with the real mygov SVG
//   (or swap the .ava / .mini contents for an <img src="/logo.svg">).

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
  status.textContent = 'online';
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
        rate_limited: 'A lot of messages at once — give it a moment and ask again.',
        server_not_configured: 'This demo is not finished being set up yet.',
        upstream_error: 'I could not reach the assistant just now. Try again.',
      }[data.error] || 'Something went wrong. Try again.';
      stamp(row('in'), msg, null);
      return;
    }

    stamp(row('in'), data.text || '', data.link || null);
    turns.push({ role: 'assistant', content: data.text || '' });
  } catch (e) {
    typingOff();
    stamp(row('in'), 'Connection lost. Check your network and try again.', null);
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
  "Salam! I'm the mygov Assistant.\n\nTell me what you need — a document, a payment, something you're not even sure the state does online — and I'll tell you whether you can do it from your phone, and exactly how.\n\nTry me: “the electricity bill is still in the old owner's name”, or “do I have to go to ASAN for a criminal record certificate?”",
  null
);
box.focus();
