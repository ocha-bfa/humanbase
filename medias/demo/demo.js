// Mode démonstration du monitoring médias — remplace auth.js et la base Supabase.
// Aucune connexion ; les données viennent de snapshot.json (seul appel à la base : le compteur anonyme media_demo_log)
// et toutes les actions du visiteur restent dans SON navigateur (localStorage),
// effaçables par « Réinitialiser la démo ».
(function () {
  'use strict';
  const KEY = 'mm_demo_v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = st => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  let ST = load(); ST.a ||= {}; ST.s ||= {}; ST.ns ||= [];

  const sat = iso => { const d = new Date(iso); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 1) % 7); return d.toISOString().slice(0, 10); };
  let ARTS = [], SRCS = [];
  const ready = (window.DEMO_SNAP ? Promise.resolve(window.DEMO_SNAP) : fetch('snapshot.json').then(r => r.json())).then(snap => {
    const EN = window.DEMO_LANG === 'en';
    const SRC_EN = { 'ONU Info (Afrique)': 'UN News (Africa)', 'Google News — Burkina humanitaire': 'Google News — Burkina humanitarian',
      'Google News — Humanitaire mondial (EN)': 'Google News — Global humanitarian (EN)', 'ReliefWeb — rapports Burkina': 'ReliefWeb — Burkina reports' };
    ARTS = snap.articles.map(a => Object.assign({
      decided_by: null, decided_at: null, summary_edited: false, triaged_at: snap.taken,
      week_start: sat(a.published_at)
    }, a, EN && a.en ? { title: a.en.title || a.title, summary: a.en.summary ?? a.summary, decided_by: ({ 'équipe PI': 'PI team', 'exemple': 'example' })[a.decided_by] || a.decided_by } : {}, ST.a[a.id] || {}));
    SRCS = snap.sources.map(s => Object.assign({ last_fetch_at: snap.taken + 'T09:08:00Z' }, s,
        EN ? { name: SRC_EN[s.name] || s.name, last_status: s.last_status.replace('articles lus', 'articles read').replace('nouveaux', 'new') } : {}, ST.s[s.id] || {}))
      .concat(ST.ns.map(s => Object.assign({}, s, ST.s[s.id] || {})));
    return true;
  });

  // ---------- Compteur d'usage anonyme (aucun nom, aucune adresse e-mail, aucune adresse IP enregistrée) ----------
  // Seuls : un identifiant de visite aléatoire, le fuseau horaire et la langue du navigateur, et la partie de la démo utilisée.
  // Le propriétaire peut exclure ses propres visites en ouvrant une fois la démo avec ?me (mémorisé dans ce navigateur).
  const SB = 'https://vshnatreclfntadwcyhy.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzaG5hdHJlY2xmbnRhZHdjeWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTA4NzcsImV4cCI6MjA4OTg2Njg3N30.VOxHkUKvYKtsdc2iwmsDMP9w-BWh3LZ4ZFLD4-qzjd8';
  let ME = false;
  try {
    if (/[?&]me\b/.test(location.search)) localStorage.setItem('mm_demo_me', '1');
    if (/[?&]notme\b/.test(location.search)) localStorage.removeItem('mm_demo_me');
    ME = localStorage.getItem('mm_demo_me') === '1';
  } catch (e) {}
  let VISIT = '';
  try { VISIT = sessionStorage.getItem('mm_demo_visit') || ''; if (!VISIT) { VISIT = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)); sessionStorage.setItem('mm_demo_visit', VISIT); } }
  catch (e) { VISIT = String(Math.random()).slice(2); }
  let TZ = ''; try { TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  const track = (event, detail) => {
    if (ME) return;
    try {
      fetch(SB + '/rest/v1/rpc/media_demo_log', { method: 'POST',
        headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_visit: VISIT, p_event: event, p_detail: detail == null ? null : String(detail), p_tz: TZ, p_lang: navigator.language || '', p_demo_lang: window.DEMO_LANG || '' })
      }).catch(() => {});
    } catch (e) {}
  };
  window.DEMO_TRACK = track;
  // Clics et changements dans la page (délégation : fonctionne aussi pour les éléments recréés)
  const CLICKS = [['#nav button[data-v]', el => ['view', el.dataset.v]], ['.acts .r', () => ['retain']], ['.acts .e', () => ['discard']],
    ['#bulk', () => ['discard_rest']], ['.mv .btn', () => ['reorder']], ['#copy', () => ['copy_outlook']], ['#xDocx', () => ['word']],
    ['#xCsv', () => ['csv']], ['#sAdd', () => ['source_add']], ['#demoBar a[href^="guide.html"]', () => ['guide']],
    ['.sum .btn.pri, .esum .btn.pri', () => ['summary_edit']]];
  document.addEventListener('click', ev => {
    for (const [sel, f] of CLICKS) { const el = ev.target.closest && ev.target.closest(sel); if (el) { track(...f(el)); return; } }
  }, true);
  document.addEventListener('change', ev => {
    const t = ev.target;
    if (t.matches && t.matches('.secSel')) track('section', t.value);
    else if (t.matches && t.matches('#wk')) track('week_change');
    else if (t.matches && t.matches('.act')) track('source_toggle', t.checked ? 'on' : 'off');
  }, true);

  window.AUTH = { token: 'demo', email: 'visiteur@demo', ready, log(kind) { if (kind === 'media_open') track('open'); } };

  const clone = x => JSON.parse(JSON.stringify(x));
  const match = (row, p) => {
    for (const [k, v] of p) {
      if (['select', 'order', 'limit'].includes(k)) continue;
      if (v.startsWith('eq.') && String(row[k]) !== v.slice(3)) return false;
      if (v.startsWith('in.(') && !v.slice(4, -1).split(',').includes(String(row[k]))) return false;
      if (v === 'is.null' && row[k] != null) return false;
    }
    return true;
  };
  window.api = async function api(path, opt = {}) {
    await ready;
    const [table, qs] = path.split('?'), p = [...new URLSearchParams(qs || '')], m = (opt.method || 'GET').toUpperCase();
    const body = opt.body ? JSON.parse(opt.body) : null;
    if (table === 'v_media_articles' && m === 'GET')
      return clone(ARTS).sort((x, y) => new Date(y.published_at) - new Date(x.published_at));
    if (table === 'media_articles' && m === 'PATCH') {
      ARTS.filter(a => match(a, p)).forEach(a => {
        Object.assign(a, body); if ('summary' in body) a.summary_edited = true;
        ST.a[a.id] = Object.assign(ST.a[a.id] || {}, body, 'summary' in body ? { summary_edited: true } : {});
      });
      save(ST); return null;
    }
    if (table === 'media_sources' && m === 'GET')
      return clone(SRCS).sort((x, y) => (y.active - x.active) || x.name.localeCompare(y.name, 'fr'));
    if (table === 'media_sources' && m === 'POST') {
      const s = Object.assign({ id: 1000 + ST.ns.length + 1, url: null, query: null, last_status: null, last_fetch_at: null }, body);
      ST.ns.push(s); SRCS.push(clone(s)); save(ST); return null;
    }
    if (table === 'media_sources' && m === 'PATCH') {
      SRCS.filter(s => match(s, p)).forEach(s => { Object.assign(s, body); ST.s[s.id] = Object.assign(ST.s[s.id] || {}, body); });
      save(ST); return null;
    }
    throw new Error(window.DEMO_LANG === 'en' ? 'not available in the demo' : 'non disponible en démo');
  };

  window.DEMO_LANG_SET = l => { track('lang', l); try { localStorage.setItem('mm_demo_lang', l); } catch (e) {} setTimeout(() => location.reload(), 400); };
  window.DEMO_RESET = () => { track('reset'); try { localStorage.removeItem(KEY); localStorage.removeItem('mm_view'); } catch (e) {} setTimeout(() => location.reload(), 400); };
})();
