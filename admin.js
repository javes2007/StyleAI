'use strict';
const API = window.APP_CONFIG.api + '/api/admin/', $ = s => document.querySelector(s);
let tok = sessionStorage.getItem('adm_tok') || '';
const e = (t, x, c) => { const n = document.createElement(t); if (x != null) n.textContent = x; if (c) n.className = c; return n; };
async function api(a, body, m) {
  const r = await fetch(API + a, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Error'); return d;
}
function tema(t) { document.documentElement.dataset.tema = t; try { localStorage.setItem('tema', t); } catch {} }
try { tema(localStorage.getItem('tema') || 'claro'); } catch {}
$('#btnTema').onclick = () => tema(document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro');
$('.ojo').onclick = ev => { const i = ev.target.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; };
function tabla(h, rows) { const w = e('div', null, 'tabla'), t = e('table'), th = e('thead'), tb = e('tbody'), r = e('tr'); h.forEach(x => r.append(e('th', x))); th.append(r); rows.forEach(a => { const tr = e('tr'); a.forEach(x => tr.append(e('td', x))); tb.append(tr); }); t.append(th, tb); w.append(t); return w; }
const vistas = {
  metricas: async c => {
    const d = await api('metricas'), f = e('div', null, 'fila');
    [['Análisis totales', d.analisis_total], ['Análisis hoy', d.analisis_hoy], ['Solicitudes nuevas', d.solicitudes_nuevas], ['Datos en cola local', d.pendientes], ['Firebase', d.firebase_activo ? 'Activo' : 'Sin respuesta']].forEach(([t, v]) => { const k = e('div', null, 'kpi'); k.append(e('b', v), e('div', t)); f.append(k); });
    c.append(f, e('h3', 'Últimos 7 días'), tabla(['Día', 'Análisis'], d.por_dia.map(x => [x.d, x.n])), e('h3', 'Ciudades con más uso'), tabla(['Ciudad', 'Análisis'], d.top_ciudades.map(x => [x.ciudad, x.n])));
  },
  notificaciones: async c => { const d = await api('notificaciones'), b = e('button', 'Marcar todas como leídas', 'btn suave'); b.onclick = async () => { await api('leer', {}); go('notificaciones'); }; c.append(b, tabla(['Fecha', 'Tipo', 'Aviso'], d.map(x => [x.creado, x.tipo, (x.leida ? '' : '● ') + x.texto]))); },
  solicitudes: async c => {
    const d = await api('solicitudes'), t = tabla(['Fecha', 'De', 'Tipo', 'Mensaje', 'Estado'], d.map(x => [x.creado, x.correo, x.tipo, x.mensaje, x.estado]));
    [...t.querySelectorAll('tbody tr')].forEach((tr, i) => { const s = document.createElement('select'); ['nueva', 'en_proceso', 'resuelta'].forEach(o => { const op = e('option', o); op.value = o; s.append(op); }); s.value = d[i].estado; s.onchange = () => api('estado', { id: d[i].id, estado: s.value }); tr.lastChild.replaceChildren(s); });
    c.append(t);
  },
  equipo: async c => {
    const d = await api('equipo'), f = document.createElement('form'), msg = e('p', '', 'msg');
    f.append(e('h3', 'Agregar colaborador'));
    const campo = (n, ph, ty = 'text') => { const i = document.createElement('input'); i.name = n; i.placeholder = ph; i.type = ty; i.required = true; return i; };
    const rol = document.createElement('select'); rol.name = 'rol'; ['moderador', 'soporte', 'analista', 'superadmin'].forEach(o => rol.append(e('option', o)));
    f.append(campo('nombre', 'Nombre'), campo('correo', 'Correo', 'email'), campo('clave', 'Clave (10 a 72 caracteres)', 'password'), rol, msg, e('button', 'Crear acceso', 'btn'));
    f.onsubmit = async ev => { ev.preventDefault(); try { const r = await api('equipo_crear', Object.fromEntries(new FormData(f))); msg.className = 'msg ok'; msg.textContent = `Creado. Clave de la app autenticadora (se muestra una sola vez): ${r.secreto}`; } catch (x) { msg.textContent = x.message; } };
    c.append(tabla(['Nombre', 'Correo', 'Rol'], d.map(x => [x.nombre, x.correo, x.rol])), f);
  },
  diseno: async c => {
    const b = e('button', 'Mover elementos de la página', 'btn'); b.onclick = () => { location.href = '../index.html?editar=1'; };
    const ta = e('textarea', '', 'codigo'); ta.placeholder = '/* CSS para toda la página. Ejemplo: .btn { border-radius: 4px; } */'; ta.maxLength = 20000;
    try { ta.value = (await (await fetch(window.APP_CONFIG.api + '/api/diseno')).json()).css || ''; } catch {}
    const m = e('p', '', 'msg'), g = e('button', 'Guardar CSS', 'btn');
    g.onclick = async () => { try { await api('css', { css: ta.value }); m.className = 'msg ok'; m.textContent = 'CSS guardado. Ya se ve en la página.'; } catch (x) { m.className = 'msg'; m.textContent = x.message; } };
    c.append(e('p', 'Abre la página y arrastra cualquier elemento marcado. Los cambios se guardan por separado para computador y celular.'), b, e('h3', 'Rediseñar con CSS'), e('p', 'Solo CSS: por seguridad no se permite JavaScript, @import ni url().', 'aviso'), ta, m, g);
  }
};
const nombres = { metricas: 'Resumen', notificaciones: 'Notificaciones', solicitudes: 'Solicitudes', equipo: 'Equipo y roles', diseno: 'Diseño' };
async function go(v) { document.querySelectorAll('#menu .tab').forEach(b => b.classList.toggle('on', b.dataset.v === v)); const c = $('#cont'); c.replaceChildren(); try { await vistas[v](c); } catch (x) { c.append(e('p', x.message, 'msg')); } }
function entrar(d) {
  $('#vLogin').hidden = true; $('#vPanel').hidden = false; $('#btnSalir').hidden = false; $('#quien').textContent = d.adm.nombre; $('#rol').textContent = d.adm.rol;
  const m = $('#menu'); m.replaceChildren(); d.permisos.forEach(p => { const b = e('button', nombres[p], 'tab'); b.dataset.v = p; b.onclick = () => go(p); m.append(b); }); go(d.permisos[0]);
}
$('#fLogin').onsubmit = async ev => {
  ev.preventDefault();
  try { const d = await api('login', { correo: $('#c').value, clave: $('#k').value, codigo: $('#o').value }); tok = d.token; sessionStorage.setItem('adm_tok', tok); entrar(d); } catch (x) { $('#m').textContent = x.message; }
};
$('#btnSalir').onclick = () => { sessionStorage.removeItem('adm_tok'); location.reload(); };
if (tok) api('me').then(entrar).catch(() => sessionStorage.removeItem('adm_tok'));
