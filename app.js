'use strict';
const C = window.APP_CONFIG, $ = s => document.querySelector(s);
const st = k => ({ get: x => { try { return k.getItem(x); } catch { return null; } }, set: (x, v) => { try { k.setItem(x, v); } catch {} }, del: x => { try { k.removeItem(x); } catch {} } });
const ls = st(localStorage), ss = st(sessionStorage);
let auth = null, user = null, modo = 'login';
try { firebase.initializeApp(C.firebase); auth = firebase.auth(); } catch {}
fetch(C.api + '/api/salud').catch(() => {});            // despierta el servidor y lanza la sincronización

// ---- tema y vistas
function tema(t) { document.documentElement.dataset.tema = t; ls.set('tema', t); }
tema(ls.get('tema') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'));
$('#btnTema').onclick = () => tema(document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro');
function ver(v) {
  if ((v === 'asesor' || v === 'perfil') && !user) v = 'auth';
  document.querySelectorAll('[data-vista]').forEach(e => e.hidden = e.dataset.vista !== v);
  if (v === 'perfil') cargarPerfil();
  scrollTo(0, 0);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-ir]'); if (b) ver(b.dataset.ir); });
if (!ls.get('cookies')) $('#cookies').hidden = false;
document.querySelectorAll('[data-ck]').forEach(b => b.onclick = () => { ls.set('cookies', b.dataset.ck); $('#cookies').hidden = true; });
document.querySelectorAll('.ojo').forEach(b => b.onclick = () => {
  const i = b.previousElementSibling, oculto = i.type === 'password';
  i.type = oculto ? 'text' : 'password'; b.textContent = oculto ? '🙈' : '👁';
  b.setAttribute('aria-label', oculto ? 'Ocultar contraseña' : 'Mostrar contraseña');
});

// ---- sesión (Firebase o servidor local si Firebase no responde)
const errores = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.', 'auth/email-already-in-use': 'Ese correo ya tiene cuenta.',
  'auth/weak-password': 'Usa mínimo 8 caracteres.', 'auth/invalid-email': 'Revisa el correo.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.', 'auth/popup-closed-by-user': 'Cerraste la ventana de acceso.',
  'auth/account-exists-with-different-credential': 'Ese correo ya existe con otro método de acceso.'
};
const msg = (el, t, ok) => { el.textContent = t; el.classList.toggle('ok', !!ok); };
const caido = err => !auth || ['auth/network-request-failed', 'auth/internal-error', 'auth/timeout'].includes(err.code);
const usuarioLocal = d => ({ uid: d.uid, email: d.correo, displayName: d.nombre, getIdToken: async () => ss.get('tokL') });
async function authLocal(ruta, body) {
  const r = await fetch(C.api + '/api/local/' + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error || 'No se pudo completar.');
  ss.set('tokL', d.token); ss.set('usrL', JSON.stringify(d)); setUser(usuarioLocal(d));
}
function setUser(u) {
  user = u; $('#btnEntrar').hidden = !!u; $('#btnPerfil').hidden = !u;
  if (u) { const p = perfil(); if (p.tema) tema(p.tema); $('#ciudad').value = p.ciudad || ''; ver('asesor'); } else ver('inicio');
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  modo = t.dataset.modo; const reg = modo === 'registro';
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
  $('#rowNombre').hidden = $('#rowAcepto').hidden = !reg;
  $('#btnAuth').textContent = reg ? 'Crear cuenta' : 'Iniciar sesión';
});
$('#formAuth').onsubmit = async e => {
  e.preventDefault();
  const m = $('#msgAuth'), c = $('#correo').value.trim(), k = $('#clave').value, n = $('#nombre').value.trim(), reg = modo === 'registro';
  if (!c || k.length < 8) return msg(m, 'Escribe tu correo y una contraseña de mínimo 8 caracteres.');
  if (reg && !$('#acepto').checked) return msg(m, 'Debes aceptar la política de privacidad.');
  msg(m, 'Un momento…', true);
  try {
    if (reg) { const cr = await auth.createUserWithEmailAndPassword(c, k); if (n) await cr.user.updateProfile({ displayName: n }); }
    else await auth.signInWithEmailAndPassword(c, k);
    msg(m, '');
  } catch (err) {
    if (!caido(err)) return msg(m, errores[err.code] || 'No se pudo completar. Intenta de nuevo.');
    try { await authLocal(reg ? 'registro' : 'login', { nombre: n, correo: c, clave: k }); msg(m, ''); } catch (e2) { msg(m, e2.message === 'Failed to fetch' ? 'No hay conexión con el servidor.' : e2.message); }
  }
};
$('#btnOlvide').onclick = async () => {
  const c = $('#correo').value.trim(), m = $('#msgAuth');
  if (!c) return msg(m, 'Escribe tu correo y vuelve a pulsar «Olvidé mi contraseña».');
  try { await auth.sendPasswordResetEmail(c); } catch {}
  msg(m, 'Si el correo existe, te enviamos un enlace para crear una contraseña nueva.', true);
};
const social = p => async () => {
  try { await auth.signInWithPopup(p); } catch (err) { msg($('#msgAuth'), caido(err) ? 'Google y Facebook no están disponibles ahora. Entra con tu correo.' : (errores[err.code] || 'No se pudo iniciar sesión.')); }
};
if (auth) { $('#btnGoogle').onclick = social(new firebase.auth.GoogleAuthProvider()); $('#btnFacebook').onclick = social(new firebase.auth.FacebookAuthProvider()); }
$('#btnSalir').onclick = () => { try { auth && auth.signOut(); } catch {} ss.del('tokL'); ss.del('usrL'); setUser(null); };
if (ss.get('tokL')) { try { setUser(usuarioLocal(JSON.parse(ss.get('usrL')))); } catch {} }
if (auth) auth.onAuthStateChanged(u => { if (u) setUser(u); else if (!ss.get('tokL')) setUser(null); });
else if (!user) setUser(null);

// ---- perfil
const perfil = () => { try { return JSON.parse(ls.get('perfil_' + (user && user.uid)) || '{}'); } catch { return {}; } };
function cargarPerfil() { const p = perfil(); $('#pNombre').value = p.nombre || user.displayName || ''; $('#pCiudad').value = p.ciudad || ''; $('#pEstilo').value = p.estilo || 'Casual'; $('#pTema').value = document.documentElement.dataset.tema; }
$('#formPerfil').onsubmit = async e => {
  e.preventDefault();
  const p = { nombre: $('#pNombre').value.slice(0, 60), ciudad: $('#pCiudad').value.slice(0, 80), estilo: $('#pEstilo').value, tema: $('#pTema').value };
  ls.set('perfil_' + user.uid, JSON.stringify(p)); tema(p.tema); $('#ciudad').value = p.ciudad;
  try { await fetch(C.api + '/api/perfil', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() }, body: JSON.stringify(p) }); } catch {}
  ver('asesor');
};

// ---- asesor IA
$('#foto').onchange = () => { const f = $('#foto').files[0], p = $('#preview'); if (f) { p.src = URL.createObjectURL(f); p.hidden = false; } };
$('#formAnalisis').onsubmit = async e => {
  e.preventDefault();
  const f = $('#foto').files[0], m = $('#msgAn');
  if (!f || !['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return msg(m, 'Sube una foto JPG, PNG o WebP.');
  if (f.size > 5 * 1024 * 1024) return msg(m, 'La foto pesa más de 5 MB.');
  if (!$('#genero').value) return msg(m, 'Elige si eres hombre o mujer.');
  const fd = new FormData();
  fd.append('foto', f); fd.append('genero', $('#genero').value); fd.append('ciudad', $('#ciudad').value.trim());
  fd.append('lugar', $('#lugar').value); fd.append('estilo', perfil().estilo || 'Casual'); fd.append('pelo', $('#pelo').checked ? 'si' : 'no');
  $('#btnAn').disabled = true; msg(m, 'Analizando tu foto… puede tardar unos segundos (si el servidor estaba dormido, hasta un minuto).', true);
  try {
    const r = await fetch(C.api + '/api/analizar', { method: 'POST', body: fd, headers: { Authorization: 'Bearer ' + await user.getIdToken() } });
    const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Error');
    msg(m, ''); pintar(d);
  } catch (err) { msg(m, err.message === 'Failed to fetch' ? 'No se pudo conectar con el servidor de la IA.' : err.message); }
  $('#btnAn').disabled = false;
};
function el(t, txt, cls) { const n = document.createElement(t); if (txt) n.textContent = txt; if (cls) n.className = cls; return n; }
const item = x => (x && typeof x === 'object') ? `${x.nombre}: ${x.razon}` : String(x);
function lista(tit, arr) { const w = document.createDocumentFragment(), u = el('ul'); w.append(el('h3', tit)); (arr || []).forEach(x => u.append(el('li', item(x)))); w.append(u); return w; }
function muestras(tit, arr, chico) {
  const w = document.createDocumentFragment(); w.append(el('h3', tit));
  (arr || []).forEach(c => { const hex = typeof c === 'string' ? c : c.hex; if (!/^#[0-9a-f]{6}$/i.test(hex)) return; const s = el('span', typeof c === 'string' ? '' : c.nombre, 'sw' + (chico ? ' chico' : '')), i = el('i'); i.style.background = hex; s.prepend(i); w.append(s); });
  return w;
}
function pintar(d) {
  const R = $('#resultado'), hombre = $('#genero').value === 'hombre';
  R.replaceChildren(); R.hidden = false; R.className = 'res';
  R.append(el('h3', 'Tu tono de piel'), el('p', `${d.tono_piel} · subtono ${d.subtono}`), muestras('Paleta de tu piel', d.colores_piel, true));
  R.append(muestras('Colores de ropa que te convienen', d.paleta_ropa), lista('Colores que conviene evitar', d.evitar));
  R.append(el('h3', 'Escaneo facial'), el('p', `Forma del rostro: ${d.forma_rostro}`), lista('Rasgos', d.rasgos));
  R.append(lista('Mejoramiento de imagen', d.mejoras), lista('Cortes de pelo que te favorecen', d.cortes));
  if (hombre && d.barba) R.append(el('h3', 'Barba'), el('p', d.barba));
  if (d.tipo_pelo) R.append(el('h3', 'Tu tipo de pelo'), el('p', `${d.tipo_pelo.tipo} · ${d.tipo_pelo.grosor}`), lista('Cuidado recomendado', d.tipo_pelo.cuidado));
  R.append(el('h3', 'Para tu clima'), el('p', d.clima_consejo), el('p', 'Es una recomendación de estilo orientativa, no un diagnóstico.', 'msg ok'));
}

// ---- solicitudes
$('#formSol').onsubmit = async e => {
  e.preventDefault(); const m = $('#msgSol');
  try {
    const r = await fetch(C.api + '/api/solicitud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: $('#sTipo').value, mensaje: $('#sMsg').value, correo: user.email, nombre: user.displayName || '', web: $('#sTrampa').value }) });
    if (!r.ok) throw 0; msg(m, 'Solicitud enviada. Te responderemos pronto.', true); $('#sMsg').value = '';
  } catch { msg(m, 'No se pudo enviar. Intenta más tarde.'); }
};
