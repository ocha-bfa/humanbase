// Mode démonstration du monitoring médias — remplace auth.js et la base Supabase.
// Aucune connexion, aucun appel à la base : les données viennent de snapshot.json
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

  window.AUTH = { token: 'demo', email: 'visiteur@demo', ready, log() {} };

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

  window.DEMO_LANG_SET = l => { try { localStorage.setItem('mm_demo_lang', l); } catch (e) {} location.reload(); };
  window.DEMO_RESET = () => { try { localStorage.removeItem(KEY); localStorage.removeItem('mm_view'); } catch (e) {} location.reload(); };
})();
