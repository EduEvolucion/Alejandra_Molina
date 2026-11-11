'use strict';

const app = document.getElementById('app');
const toastNode = document.getElementById('toast');
const modalRoot = document.getElementById('modal-root');
const enc = new TextEncoder();
const dec = new TextDecoder();
const AAD = 'RECUERDO-PRIVADO-V1';
const prefersLessMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let unlocked = null;
let current = 0;
let gateOpened = false;
let letterOpened = false;
let phraseIndex = 0;
let jokeClicks = 0;
let galleryJokeClicks = 0;
const revealedNotes = new Set();
let toastTimer = null;
const labels = ['Portada','Página 2','Página 3','Página 4','Página 5','Página 6'];

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}
function b64ToBytes(str) {
  const raw = atob(str);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}
async function unlock(code) {
  // La carga como script clásico evita CORS al abrir index.html mediante file://.
  // Sigue siendo un paquete cifrado: el texto y las fotografías no están en claro.
  const p = window.__RECUERDO_CIFRADO__;
  if (!p) throw new Error('No se pudo cargar el recuerdo.');
  const normalizedCode = String(code).replace(/[\s-]/g, '').toUpperCase();
  if (p.version !== 1 || p.kdf?.name !== 'PBKDF2' || p.cipher?.name !== 'AES-GCM' || p.aad !== AAD) {
    throw new Error('Formato no compatible.');
  }
  const codeKey = await crypto.subtle.importKey('raw', enc.encode(normalizedCode), 'PBKDF2', false, ['deriveKey']);
  const aesKey = await crypto.subtle.deriveKey({
    name: 'PBKDF2', salt: b64ToBytes(p.kdf.salt), iterations: p.kdf.iterations, hash: 'SHA-256'
  }, codeKey, {name:'AES-GCM', length:256}, false, ['decrypt']);
  const plainBytes = await crypto.subtle.decrypt({
    name:'AES-GCM', iv:b64ToBytes(p.cipher.iv), additionalData:enc.encode(AAD), tagLength:128
  }, aesKey, b64ToBytes(p.cipher.data));
  return JSON.parse(dec.decode(plainBytes));
}

function floralMark() {
  return `<svg viewBox="0 0 280 370" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <circle cx="187" cy="92" r="72" fill="#F6EACB" opacity=".68"/>
    <path d="M-30 311C67 260 184 284 307 232V400H-30Z" fill="#9BAE8F" opacity=".42"/>
    <path d="M132 367C138 275 139 190 151 109" stroke="#637F69" stroke-width="3" stroke-linecap="round"/>
    <path d="M141 240C85 241 64 204 56 166C112 170 143 205 141 240Z" fill="#6E9474" opacity=".87"/>
    <path d="M139 286C195 275 223 239 227 198C177 208 145 240 139 286Z" fill="#A8BC99"/>
    <path d="M148 167C110 160 88 137 85 109C119 112 148 134 148 167Z" fill="#94B096"/>
    <path d="M153 121C179 103 189 76 181 52C159 61 146 92 153 121Z" fill="#739078"/>
    <g transform="translate(150 79)"><ellipse rx="19" ry="42" fill="#F2DDD2" transform="rotate(0) translate(0 -27)"/><ellipse rx="19" ry="42" fill="#EAC5B3" transform="rotate(72) translate(0 -27)"/><ellipse rx="19" ry="42" fill="#F1DBCC" transform="rotate(144) translate(0 -27)"/><ellipse rx="19" ry="42" fill="#E9C2B5" transform="rotate(216) translate(0 -27)"/><ellipse rx="19" ry="42" fill="#F1D9C8" transform="rotate(288) translate(0 -27)"/><circle r="22" fill="#CBAD72"/><circle r="12" fill="#E1C68D"/></g>
    <path d="M25 343C71 316 99 322 132 343" stroke="#61816D" stroke-width="2" opacity=".7"/>
  </svg>`;
}
function showToast(message) {
  clearTimeout(toastTimer);
  toastNode.textContent = String(message);
  toastNode.classList.add('show');
  toastTimer = setTimeout(() => toastNode.classList.remove('show'), 3100);
}
function delight(originEl) {
  if (prefersLessMotion) return;
  const box = originEl?.getBoundingClientRect() ?? {left:window.innerWidth/2,top:window.innerHeight/2,width:0,height:0};
  const centerX = box.left + box.width / 2;
  const centerY = box.top + box.height / 2;
  const symbols = ['✦','❀','✧','❃','✳','✦'];
  for (let i=0;i<11;i++) {
    const piece = document.createElement('span');
    piece.className = 'floating-leaf';
    piece.textContent = symbols[i % symbols.length];
    piece.style.cssText = `left:${centerX+(Math.random()-.5)*70}px;top:${centerY}px;color:${i%2?'#b99c69':'#849e83'};--tx:${(Math.random()-.5)*220}px;--rot:${(Math.random()-.5)*160}deg;animation-delay:${i*35}ms;`;
    document.body.appendChild(piece);
    setTimeout(()=>piece.remove(),2300);
  }
}
function drawLocked() {
  app.innerHTML = `<main class="lock-layout">
    <section class="lock-card" aria-labelledby="lock-title">
      <div class="lock-top"><span></span><p class="eyebrow" style="margin:0">UN PEQUEÑO DETALLE</p><span></span></div>
      <div class="lock-seal"><span class="seal-center">✳</span></div>
      <h1 class="lock-title" id="lock-title">Hay historias que<br><em class="highlight">merecen abrirse.</em></h1>
      <p class="lock-desc">Algunos recuerdos esperan al otro lado de una pequeña puerta.</p>
      <form class="access-form" id="access-form">
        <label class="access-label" for="access-code">Código de acceso</label>
        <div class="access-wrap"><input class="access-input" id="access-code" name="access" type="password" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="32" aria-describedby="access-error" required placeholder="Tu código"/><button class="access-eye" type="button" id="reveal-code" aria-label="Mostrar código" title="Mostrar código">◉</button></div>
        <button class="btn btn-primary" type="submit" id="submit-code">Abrir este recuerdo <span aria-hidden="true">→</span></button>
        <div class="access-error" role="status" aria-live="polite" id="access-error"></div>
      </form>
      <p class="lock-footer">HECHO PARA GUARDAR ALGO BONITO</p>
    </section>
  </main>`;
  const codeInput = document.getElementById('access-code');
  const submit = document.getElementById('submit-code');
  const error = document.getElementById('access-error');
  document.getElementById('reveal-code').onclick = e => {
    const reveal = codeInput.type === 'password';
    codeInput.type = reveal?'text':'password';
    e.currentTarget.setAttribute('aria-label',reveal?'Ocultar código':'Mostrar código');
    e.currentTarget.title = reveal?'Ocultar código':'Mostrar código';
  };
  document.getElementById('access-form').addEventListener('submit', async evt => {
    evt.preventDefault();
    error.textContent='';
    submit.disabled = true;
    submit.textContent='Abriendo con cuidado…';
    try {
      if (!window.isSecureContext || !crypto?.subtle) throw new Error('Necesitas abrir la página por HTTPS o localhost.');
      unlocked = await unlock(codeInput.value);
      codeInput.value='';
      document.title = `${unlocked.portada.tituloBase} ${unlocked.portada.tituloDestacado} · ${unlocked.persona.nombreCorto}`;
      current=0;
      drawScene();
      window.scrollTo({top:0,behavior:'instant'});
    } catch (e) {
      const isLoad = String(e?.message||'').includes('cargar');
      error.textContent = !window.isSecureContext ? 'Abre este recuerdo desde un enlace seguro (HTTPS).' : isLoad ? 'Todavía no se encuentra disponible el recuerdo.' : 'Este código no abrió la puerta. Puedes intentarlo otra vez.';
      codeInput.focus();
    } finally {
      submit.disabled=false;
      submit.innerHTML='Abrir este recuerdo <span aria-hidden="true">→</span>';
    }
  });
}

function sceneHome(d) {
  return `<section class="scene scene-home" aria-labelledby="chapter-heading">
    <div>
      <div class="scene-kicker"><p class="eyebrow">${safe(d.portada.etiqueta)}</p></div>
      <h1 class="display cover-title" id="chapter-heading">${safe(d.portada.tituloBase)} <em>${safe(d.portada.tituloDestacado)}</em></h1>
      <p class="cover-dedication">${safe(d.portada.dedicatoria)}</p>
      <p class="lead">${safe(d.portada.texto)}</p>
      <div class="cover-actions"><button class="btn btn-primary" data-action="next">${safe(d.portada.boton)} <span class="icon-arrow">→</span></button></div>
    </div>
    <div class="cover-art" aria-hidden="true">
      <div class="cover-frame"><div class="cover-garden">${floralMark()}</div></div>
      <div class="cover-note">${safe(d.portada.nota)}</div>
      <div class="cover-stamp"><strong>${safe(d.portada.selloNumero)}</strong><small>${safe(d.portada.selloTexto)}</small></div>
    </div>
  </section>`;
}
function sceneGate(d) {
  const c = d.encuentro;
  return `<section class="scene scene-gate" aria-labelledby="chapter-heading">
    <div class="gate-copy">
      <div class="scene-kicker"><p class="eyebrow">${safe(c.etiqueta)}</p></div>
      <h1 id="chapter-heading" class="chapter-title">${safe(c.tituloBase)} <em>${safe(c.tituloDestacado)}</em></h1>
      <p class="lead">${safe(c.introduccion)}</p>
      ${gateOpened?`<div class="reveal-card" style="margin-top:22px"><p>${safe(c.revelacion)}</p><p>${safe(c.detalle)}</p></div>`:`<p class="mini-label" style="margin-top:22px">Un encuentro que no estaba planeado…</p>`}
    </div>
    <div class="gate-wrap">
      <div class="gate-illustration" role="img" aria-label="Un portón ilustrado ${gateOpened?'abierto':'cerrado'} junto a un jardín">
        <div class="gate-path"></div><div class="gate-wall left"></div><div class="gate-wall right"></div>
        <div class="gate-badge">${safe(c.anio)}</div>
        <div class="gate-leaf left ${gateOpened?'open':''}"></div><div class="gate-leaf right ${gateOpened?'open':''}"></div>
      </div>
      ${gateOpened?`<p class="mini-label">Y así empezó una bonita coincidencia ✦</p>`:`<button class="btn btn-primary" data-action="gate-open">${safe(c.boton)} <span class="icon-arrow">→</span></button>`}
    </div>
    <div class="scene-flower"></div>
  </section>`;
}
function sceneGestures(d) {
  const c=d.gestos;
  return `<section class="scene scene-gestures" aria-labelledby="chapter-heading">
    <div class="gestures-header">
      <div class="scene-kicker"><p class="eyebrow">${safe(c.etiqueta)}</p></div>
      <h1 id="chapter-heading" class="chapter-title">${safe(c.tituloBase)} <em>${safe(c.tituloDestacado)}</em></h1>
      <p class="lead">${safe(c.introduccion)}</p>
    </div>
    <div class="cards-grid">${c.tarjetas.map((m,i)=>`<button class="memory-card ${revealedNotes.has(i)?'revealed':''}" data-action="note" data-index="${i}" aria-expanded="${revealedNotes.has(i)}">
      <span class="num">${safe(m.numero)}</span><span class="card-art" aria-hidden="true">${['❋','✦','❧'][i%3]}</span><span class="card-title">${safe(m.titulo)}</span><span class="card-hint">${revealedNotes.has(i)?'Tocar para cerrar':'Tocar para descubrir ✦'}</span><span class="card-back">${safe(m.texto)}</span>
    </button>`).join('')}</div>
    <div class="tease"><p>${safe(c.bromaPregunta)}</p><button class="btn btn-secondary tease-button" data-action="joke">${safe(c.bromaBoton)}</button></div>
  </section>`;
}
function sceneGallery(d) {
  const c=d.galeria;
  return `<section class="scene scene-gallery" aria-labelledby="chapter-heading">
    <header class="gallery-header">
      <p class="eyebrow">${safe(c.etiqueta)}</p>
      <h1 id="chapter-heading" class="chapter-title">${safe(c.tituloBase)} <em>${safe(c.tituloDestacado)}</em></h1>
      <p class="lead">${safe(c.introduccion)}</p>
    </header>
    <div class="photo-grid">${c.fotos.map((f,i)=>`<button type="button" class="photo-frame" data-action="photo" data-index="${i}" style="--tilt:${[-3,2,-1,3,-2,1][i%6]}deg" aria-label="${safe(f.imagen?'Ver fotografía '+(i+1):'Recuerdo '+(i+1))}">
      <span class="photo-art">${f.imagen?`<img loading="lazy" alt="${safe(f.titulo)}" src="${safe(f.imagen)}"/>`:`<span class="photo-placeholder"></span>`}<span class="photo-index">${String(i+1).padStart(2,'0')}</span></span>
      <span class="photo-caption">${safe(f.titulo)}</span>
    </button>`).join('')}</div>
    <div class="gallery-surprise"><p>${safe(c.bromaPregunta || c.notaSinFotos)}</p><button type="button" class="btn btn-secondary btn-small" data-action="gallery-joke">${safe(c.bromaBoton || 'Ver sorpresa ✦')}</button></div>
    <p class="gallery-end">${safe(c.notaSinFotos)}</p>
  </section>`;
}
function sceneLetter(d) {
  const c=d.carta;
  if (!letterOpened) return `<section class="scene scene-letter" aria-labelledby="chapter-heading">
    <div class="letter-copy">
      <div class="scene-kicker"><p class="eyebrow">${safe(c.etiqueta)}</p></div>
      <h1 id="chapter-heading" class="chapter-title">${safe(c.tituloBase)} <em>${safe(c.tituloDestacado)}</em></h1>
      <p class="lead">${safe(c.instruccion)}</p>
    </div>
    <div class="letter-art"><button class="envelope" data-action="open-letter" aria-label="Abrir carta"><span class="envelope-seal">✳</span><span class="envelope-label">${safe(c.sobre)} · tocar para abrir</span></button></div>
  </section>`;
  return `<section class="scene scene-letter-reading letter-reading" aria-labelledby="chapter-heading">
    <header class="letter-header"><p class="eyebrow">${safe(c.etiqueta)}</p><h1 id="chapter-heading" class="chapter-title" style="margin-inline:auto">${safe(c.encabezado)}</h1></header>
    <article class="letter-page">${c.parrafos.map(p=>`<p>${safe(p)}</p>`).join('')}<p class="signature">${safe(c.firma)}</p></article>
    <button class="btn btn-text letter-tease" data-action="letter-surprise">✳ Una última anotación al margen</button>
  </section>`;
}
function sceneEnd(d) {
  const c=d.final;
  return `<section class="scene scene-end" aria-labelledby="chapter-heading">
    <p class="eyebrow">${safe(c.etiqueta)}</p>
    <div class="end-flower" aria-hidden="true"><span class="flower-stem"></span>${Array.from({length:8},(_,i)=>`<span class="petal" style="--r:${i*45}deg"></span>`).join('')}<span class="flower-core"></span></div>
    <h1 id="chapter-heading" class="chapter-title">${safe(c.tituloBase)} <em>${safe(c.tituloDestacado)}</em></h1>
    <p class="lead" style="text-align:center">${safe(c.introduccion)}</p>
    <div class="end-message-card" key="${phraseIndex}">“${safe(c.mensajes[phraseIndex % c.mensajes.length])}”</div>
    <button class="btn btn-secondary" data-action="next-phrase">✦ Descubrir otro mensaje</button>
    <div class="end-rule"></div>
    <p class="end-small">${safe(c.cierre)}<br>${safe(c.subtitulo)}</p>
    <p class="end-signature">${safe(c.firma)} · ${safe(c.fecha)}</p>
    <button class="btn btn-text" data-action="begin-again" style="margin-top:15px">↶ Volver al comienzo</button>
  </section>`;
}
function drawScene() {
  if (!unlocked) return drawLocked();
  const creators = [sceneHome,sceneGate,sceneGestures,sceneGallery,sceneLetter,sceneEnd];
  const view = creators[current](unlocked);
  app.innerHTML = `<div class="experience">
    <header class="topbar">
      <div class="brand"><span class="brand-symbol">✳</span> <span>Un pequeño recuerdo</span></div>
      <div class="topbar-right"><span class="chapter-counter">${String(current+1).padStart(2,'0')} / 06</span><div class="progress" role="group" aria-label="Progreso de la experiencia">${labels.map((l,i)=>`<button class="progress-dot ${i===current?'active':''}" data-action="goto" data-index="${i}" aria-label="Ir a ${safe(l)}" aria-current="${i===current?'step':'false'}" title="${safe(l)}"></button>`).join('')}</div></div>
    </header>
    <main class="stage" id="main-content"><div class="paper-stage">${view}</div></main>
    <nav class="foot-nav" aria-label="Navegación entre capítulos">
      <button class="btn btn-secondary btn-small" data-action="prev" ${current===0?'disabled':''}>← Anterior</button>
      <span class="nav-quote">${current===5?'Lo que permanece ✦':'Un recuerdo, página por página'}</span>
      <button class="btn btn-primary btn-small" data-action="next" ${current===5?'disabled':''}>Siguiente →</button>
    </nav>
  </div>`;
  // The experience stays in memory only. Nothing goes to localStorage/sessionStorage.
}
function goto(index) {
  current = Math.max(0,Math.min(5,Number(index)));
  drawScene();
  window.scrollTo({top:0,behavior:prefersLessMotion?'instant':'smooth'});
}
function showPhoto(index) {
  const p=unlocked.galeria.fotos[index];
  if (!p?.imagen) {
    showToast(unlocked.galeria.notaSinFotos);
    return;
  }
  const priorFocus=document.activeElement;
  modalRoot.innerHTML=`<div class="photo-modal-backdrop" data-dismiss="modal"><div class="photo-modal" role="dialog" aria-modal="true" aria-label="Fotografía ampliada"><button class="modal-close" type="button" data-action="close-photo" aria-label="Cerrar fotografía">×</button><img src="${safe(p.imagen)}" alt="${safe(p.titulo)}"/><h2>${safe(p.titulo)}</h2><p>${safe(p.descripcion)}</p></div></div>`;
  modalRoot.querySelector('.modal-close').focus();
  modalRoot.dataset.priorFocus='true';
  modalRoot._priorFocus=priorFocus;
  document.body.style.overflow='hidden';
}
function closePhoto() {
  modalRoot.innerHTML='';
  document.body.style.overflow='';
  modalRoot._priorFocus?.focus();
}
app.addEventListener('click',evt=>{
  const actionEl=evt.target.closest('[data-action]');
  if (!actionEl || !unlocked) return;
  const action=actionEl.dataset.action;
  if (action==='next') goto(current+1);
  else if(action==='prev') goto(current-1);
  else if(action==='goto') goto(actionEl.dataset.index);
  else if(action==='gate-open') {gateOpened=true;drawScene();delight(document.querySelector('.gate-illustration'));}
  else if(action==='note') {
    const i=Number(actionEl.dataset.index);
    revealedNotes.has(i)?revealedNotes.delete(i):revealedNotes.add(i);
    drawScene();
  }
  else if(action==='joke') {
    jokeClicks++;
    actionEl.classList.remove('jiggle');
    void actionEl.offsetWidth;
    actionEl.classList.add('jiggle');
    showToast(jokeClicks===1 ? unlocked.gestos.bromaRespuesta : unlocked.gestos.bromaSegunda);
    delight(actionEl);
  }
  else if(action==='photo') showPhoto(Number(actionEl.dataset.index));
  else if(action==='gallery-joke') {
    galleryJokeClicks++;
    showToast(galleryJokeClicks===1 ? unlocked.galeria.bromaRespuesta : unlocked.galeria.bromaSegunda);
    delight(actionEl);
  }
  else if(action==='open-letter'){letterOpened=true;drawScene();showToast(unlocked.carta.aviso);}
  else if(action==='letter-surprise') {showToast(unlocked.carta.bromaRespuesta);delight(actionEl);}
  else if(action==='next-phrase') {phraseIndex=(phraseIndex+1)%unlocked.final.mensajes.length;drawScene();delight(document.querySelector('.end-flower'));}
  else if(action==='begin-again') goto(0);
});
modalRoot.addEventListener('click',evt=>{
  if (evt.target.dataset.dismiss==='modal' || evt.target.closest('[data-action="close-photo"]')) closePhoto();
});
document.addEventListener('keydown',evt=>{
  if(evt.key==='Escape' && modalRoot.firstChild) closePhoto();
  if(!unlocked || modalRoot.firstChild || ['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if(evt.key==='ArrowRight')goto(current+1);
  if(evt.key==='ArrowLeft')goto(current-1);
});
window.addEventListener('pagehide',()=>{
  // Remove decrypted content even if the browser restores this page from its back/forward cache.
  unlocked=null;
  document.title='Un pequeño detalle';
  drawLocked();
});
drawLocked();
