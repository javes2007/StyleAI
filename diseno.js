'use strict';
// Aplica el diseño guardado por el administrador y, con ?editar=1 y sesión de admin, permite arrastrar elementos.
(() => {
  const A = window.APP_CONFIG.api, bp = () => innerWidth >= 768 ? 'pc' : 'movil';
  let datos = { layout: {}, css: '' }, cambios = {}, editando = false;
  const aplicar = () => document.querySelectorAll('[data-mov]').forEach(e => {
    const p = (cambios[e.dataset.mov]) || ((datos.layout || {})[bp()] || {})[e.dataset.mov];
    e.style.translate = p ? `${p.x}px ${p.y}px` : '';
  });
  async function cargar() {
    try { datos = await (await fetch(A + '/api/diseno')).json(); } catch {}
    try { if (datos.css) { const s = new CSSStyleSheet(); s.replaceSync(datos.css); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; } } catch {}
    aplicar();
    const tok = sessionStorage.getItem('adm_tok');
    if (new URLSearchParams(location.search).get('editar') === '1' && tok) editor(tok);
  }
  function editor(tok) {
    editando = true; document.body.classList.add('editando');
    const barra = document.createElement('div'); barra.className = 'barra-edit';
    const t = document.createElement('b'); t.textContent = `Editando diseño (${bp() === 'pc' ? 'computador' : 'celular'}). Arrastra los elementos.`;
    const b = (txt, fn) => { const x = document.createElement('button'); x.className = 'btn'; x.textContent = txt; x.onclick = fn; return x; };
    const msg = document.createElement('span');
    let reiniciar = false;
    const guardar = async () => {
      const L = reiniciar ? {} : { ...((datos.layout || {})[bp()] || {}), ...cambios };
      const r = await fetch(A + '/api/admin/diseno', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ bp: bp(), layout: L }) });
      msg.textContent = r.ok ? 'Guardado ✔' : 'No se pudo guardar (¿sesión vencida?)';
      if (r.ok) { datos.layout = { ...(datos.layout || {}), [bp()]: L }; cambios = {}; reiniciar = false; }
    };
    const reset = () => { cambios = {}; reiniciar = true; document.querySelectorAll('[data-mov]').forEach(e => e.style.translate = ''); msg.textContent = 'Restablecido: pulsa Guardar para confirmar'; };
    barra.append(t, b('Guardar', guardar), b('Restablecer', reset), b('Volver al panel', () => location.href = 'admin/'), msg);
    document.body.prepend(barra);
    document.addEventListener('click', e => { if (editando && !e.target.closest('.barra-edit')) { e.preventDefault(); e.stopPropagation(); } }, true);
    let act = null;
    document.addEventListener('pointerdown', e => {
      const el = e.target.closest('[data-mov]'); if (!el || e.target.closest('.barra-edit')) return;
      const p = (cambios[el.dataset.mov]) || ((datos.layout || {})[bp()] || {})[el.dataset.mov] || { x: 0, y: 0 };
      act = { el, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y }; el.setPointerCapture(e.pointerId);
    });
    document.addEventListener('pointermove', e => {
      if (!act) return; const x = Math.round(act.ox + e.clientX - act.sx), y = Math.round(act.oy + e.clientY - act.sy);
      act.el.style.translate = `${x}px ${y}px`; cambios[act.el.dataset.mov] = { x, y };
    });
    document.addEventListener('pointerup', () => { act = null; });
  }
  addEventListener('resize', () => { if (!editando) aplicar(); });
  cargar();
})();
