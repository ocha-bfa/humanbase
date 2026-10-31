// Démo LIVE du monitoring médias — remplace auth.js et la base Supabase dans la VRAIE page ../index.html.
// Données : vues publiques en lecture seule (articles triés aujourd'hui par l'IA, sources, configuration).
// Toutes les actions du visiteur (Retenu / Écarté, rubriques, résumés, ordre, sources) restent dans SON navigateur.
(function () {
  'use strict';
  const SB = 'https://vshnatreclfntadwcyhy.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzaG5hdHJlY2xmbnRhZHdjeWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTA4NzcsImV4cCI6MjA4OTg2Njg3N30.VOxHkUKvYKtsdc2iwmsDMP9w-BWh3LZ4ZFLD4-qzjd8';
  const C = window.LIVE_COUNTRY, EN = window.LIVE_LANG === 'en';
  const KEY = 'mm_live_v1_' + C;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = st => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  let ST = load(); ST.a ||= {}; ST.s ||= {}; ST.ns ||= [];
  const H = { apikey: ANON, Authorization: 'Bearer ' + ANON };
  const get = p => fetch(SB + '/rest/v1/' + p, { headers: H }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Semaine glissante : les 7 derniers jours forment « la semaine » de la démo (la semaine précédente reste consultable)
  const DAY = 864e5, today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const W0 = new Date(today - 6 * DAY).toISOString().slice(0, 10), W1 = new Date(today - 13 * DAY).toISOString().slice(0, 10);
  const wk = iso => (new Date(iso) >= new Date(W0 + 'T00:00:00Z') ? W0 : W1);
  const hash = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 1e9 + 1; };

  const MODEL_NAMES = { 'qwen/qwen3.8-27b': 'Qwen3.8 27B (open source, Alibaba)', 'anthropic/claude-haiku-5.5': 'Claude Haiku 5.5 (Anthropic)' };
  const modelName = m => { if (!m) return EN ? 'AI model' : 'modèle IA'; const k = Object.keys(MODEL_NAMES).find(k => m.startsWith(k)); return k ? MODEL_NAMES[k] : m; };

  let ARTS = [], SRCS = [], ERR = null;
  const ready = Promise.all([
    get(`media_public_live?select=id,published_at,outlet,url,title,section_code,summary,score,sorted_at,lang,model&country_code=eq.${encodeURIComponent(C)}&order=published_at.desc&limit=3000`),
    get(`media_public_sources?select=*&country_code=eq.${encodeURIComponent(C)}&order=name`)
  ]).then(([arts, srcs]) => {
    ARTS = arts.map(a => Object.assign({
      id: a.id, outlet: a.outlet, url: a.url, title: a.title, published_at: a.published_at, lang: a.lang,
      ai_relevant: true, ai_score: a.score, section: a.section_code, ai_section: a.section_code, summary: a.summary,
      decision: null, decided_by: null, decided_at: null, week_start: wk(a.published_at), triaged_at: a.sorted_at,
      other_links: [], summary_basis: null, summary_edited: false, week_rank: null
    }, ST.a[a.id] || {}));
    SRCS = srcs.map(s => {
      const id = hash(s.name);
      return Object.assign({
        id, name: s.name, kind: s.kind, lang: s.lang, default_section: s.default_section, active: true, last_fetch_at: s.last_fetch_at,
        url: s.kind === 'rss' ? s.target : null, query: s.kind === 'rss' ? null : s.target,
        last_status: s.status === 'ok' ? (EN ? 'OK — read' : 'OK — lue')
          : s.status === 'error' ? (EN ? 'read failed, retried next hour' : 'lecture échouée, nouvel essai à la prochaine heure') : null
      }, ST.s[id] || {});
    }).concat(ST.ns.map(s => Object.assign({}, s, ST.s[s.id] || {})));
    // Bandeau : moteur et heure du dernier tri
    const models = {}; arts.forEach(a => models[a.model] = (models[a.model] || 0) + 1);
    const main = Object.keys(models).sort((x, y) => models[y] - models[x])[0];
    const last = arts.reduce((m, a) => (a.sorted_at > m ? a.sorted_at : m), '');
    const setBar = () => {
      const e = document.getElementById('liveEngine'); if (e) e.textContent = modelName(main);
      const l = document.getElementById('liveLast');
      if (l) l.textContent = last ? new Date(last).toLocaleString(EN ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setBar); else setBar();
    return true;
  }).catch(e => { ERR = e; return true; });

  window.AUTH = { token: 'live', email: EN ? 'visitor' : 'visiteur', ready, log() {} };

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
    if (ERR) throw ERR;
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
      return clone(SRCS).sort((x, y) => (y.active - x.active) || x.name.localeCompare(y.name, EN ? 'en' : 'fr'));
    if (table === 'media_sources' && m === 'POST') {
      const s = Object.assign({ id: 2e9 + ST.ns.length + 1, url: null, query: null, last_status: null, last_fetch_at: null }, body);
      ST.ns.push(s); SRCS.push(clone(s)); save(ST); return null;
    }
    if (table === 'media_sources' && m === 'PATCH') {
      SRCS.filter(s => match(s, p)).forEach(s => { Object.assign(s, body); ST.s[s.id] = Object.assign(ST.s[s.id] || {}, body); });
      save(ST); return null;
    }
    throw new Error(EN ? 'not available in the demo' : 'non disponible en démo');
  };

  // ---------- Onglet « Configuration » : une application, une fiche par pays ----------
  const T = EN ? {
    loading: 'Loading configuration…', h: 'One application, one configuration sheet per country',
    lead: 'Each country (or office) is a simple sheet: its sources, sections, language, scope and AI engine. The code, database and processing pipeline are shared. Adding a country requires no new development.',
    s: ['<b>1 · Sources</b>A list of websites (RSS feeds) and Google News searches.', '<b>2 · Sections & language</b>The sections of the press review and the language of the summaries.',
      '<b>3 · Scope</b>A few sentences: what is relevant to the team and what is not.', "<b>4 · Learning</b>The team's past published press reviews serve as examples for the engine."],
    plugged: 'Countries plugged in today', engine: 'AI engine', lang: 'Summary language', sec: 'Sections', src: 'Sources monitored', ref: "Team's examples",
    refTxt: (a, b) => `${a} articles selected in ${b} published reviews`, sorted: 'Articles sorted to date', freq: 'Frequency', freqTxt: '3 times a day · ', scope: 'Scope', rules: 'See the rules',
    LANG: { fr: 'French', en: 'English' }, open: 'Open', note: 'The full list of sources for this country is in the « Sources » tab.', err: 'Configuration unavailable', loc: 'en-GB'
  } : {
    loading: 'Chargement de la configuration…', h: 'Une application, une fiche de configuration par pays',
    lead: "Chaque pays (ou bureau) est une simple fiche : ses sources, ses rubriques, sa langue, son périmètre et son moteur d'IA. Le code, la base de données et la chaîne de traitement sont communs. Ajouter un pays ne demande aucun nouveau développement.",
    s: ['<b>1 · Sources</b>Liste de sites (flux RSS) et de recherches Google Actualités.', '<b>2 · Rubriques & langue</b>Les sections de la revue de presse et la langue des résumés.',
      "<b>3 · Périmètre</b>Quelques phrases : ce qui est pertinent ou non pour l'équipe.", "<b>4 · Apprentissage</b>Les revues de presse déjà publiées par l'équipe servent d'exemples au moteur."],
    plugged: "Les pays branchés aujourd'hui", engine: "Moteur d'IA", lang: 'Langue des résumés', sec: 'Rubriques', src: 'Sources suivies', ref: "Exemples de l'équipe",
    refTxt: (a, b) => `${a} articles retenus dans ${b} revues publiées`, sorted: 'Articles triés à ce jour', freq: 'Fréquence', freqTxt: '3 fois par jour · ', scope: 'Périmètre', rules: 'Voir les règles',
    LANG: { fr: 'Français', en: 'Anglais' }, open: 'Ouvrir', note: 'La liste complète des sources de ce pays est dans l\'onglet « Sources ».', err: 'Configuration indisponible', loc: 'fr-FR'
  };
  window.LIVE_CFG = async function () {
    const main = document.getElementById('main');
    main.innerHTML = `<div class="empty">${T.loading}</div>`;
    try {
      const cfg = await get('media_public_config?select=*');
      const order = (window.LIVE_COUNTRIES || []).map(c => c.code);
      const cs = cfg.sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
      const ALLS = window.LIVE_ALLSECTIONS || [];
      const nf = n => Number(n || 0).toLocaleString(T.loc);
      const secs = code => ALLS.filter(x => x.country_code === code).map(x => `<span class="tag" style="background:#E8F1F9;color:#026CB6;font-weight:600" title="${esc(x.label)}">${esc(x.code)}</span>`).join(' ');
      const names = code => ALLS.filter(x => x.country_code === code).map(x => esc(x.label)).join(' · ');
      const row = (label, f) => `<tr><td style="color:var(--mut);width:190px">${label}</td>${cs.map(c => `<td>${f(c)}</td>`).join('')}</tr>`;
      main.innerHTML = `
      <div class="panel"><h3>${T.h}</h3><p style="margin:0">${T.lead}</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">${T.s.map(x => `<div style="flex:1;min-width:170px;background:#E8F1F9;border-radius:8px;padding:8px 10px;font-size:13px">${x.replace('<b>', '<b style="color:#026CB6;display:block">')}</div>`).join('')}</div></div>
      <h2 class="sec">${T.plugged}</h2>
      <table><thead><tr><th></th>${cs.map(c => `<th style="color:#026CB6">${esc(c.name_fr)}${c.code === C ? '' : ` · <a href="?c=${esc(c.code)}" onclick="LIVE_SWITCH('${esc(c.code)}');return false" style="color:#026CB6">${T.open}</a>`}</th>`).join('')}</tr></thead><tbody>
        ${row(T.engine, c => esc(modelName(c.engine)))}
        ${row(T.lang, c => T.LANG[c.summary_lang] || esc(c.summary_lang))}
        ${row(T.sec, c => `<div>${secs(c.code)}</div><div style="color:var(--mut);font-size:12px;margin-top:4px">${names(c.code)}</div>`)}
        ${row(T.src, c => nf(c.n_sources))}
        ${row(T.ref, c => c.n_reference ? T.refTxt(nf(c.n_reference), nf(c.n_reference_digests)) : '—')}
        ${row(T.sorted, c => nf(c.n_sorted))}
        ${row(T.freq, c => T.freqTxt + esc(c.schedule))}
        ${row(T.scope, c => `<details><summary style="cursor:pointer;color:#026CB6">${T.rules}</summary><div style="margin-top:6px;white-space:pre-wrap">${esc(c.scope_rules || '')}</div></details>`)}
      </tbody></table>
      <p class="help">${T.note}</p>`;
    } catch (e) { main.innerHTML = `<div class="empty">${T.err} (${esc(e.message)}).</div>`; }
  };

  window.LIVE_SWITCH = code => { try { localStorage.setItem('mm_live_country', code); } catch (e) {} location.search = '?c=' + encodeURIComponent(code); };
  window.LIVE_RESET = () => { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); };
})();
