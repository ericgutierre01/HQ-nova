// El cubo GeekMagic (HelloCubic-Lite) de la mesa: enseña la Nova del chat actual, con su color y su ropa.
// Se configura en ⚙ Ajustes → 🧊 Cubo: la dirección va en ~/.claude/nova-cubo.json y lo demás en nova-prefs.json. Cada GIF (240x240) se dibuja con Chrome la
// primera vez que hace falta (y las demás poses de ese aspecto, por adelantado) y se queda en el cubo; después solo se cambia cuál se ve.
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CUBE_MOODS, cuboPick } from '../../hooks/cubo.js';

const CONF = path.join(os.homedir(), '.claude', 'nova-cubo.json');
const CHROME = process.env.NOVA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const KEEP = 48;               // GIFs de Nova como mucho; lo que de verdad manda es el espacio libre (SPARE)
const SPARE = 100_000;         // lo que se deja libre en el cubo para tus fotos
// Sin ningún Claude abierto (o al apagarse el servidor): Nova intentando enchufar su PC, en el color de tu Nova.
const OFFLINE = { mood: 'waiting', text: 'Conectando con Claude', plug: true };
// El enchufe: la clavija va hacia la pared, salta la chispa, parpadea la luz y vuelve a intentarlo (2 s en bucle).
const PLUG = `<svg viewBox="0 0 240 240" width="240" height="240" style="position:absolute;left:0;top:0">
<style>
@keyframes push { 0%,12% { transform: translateX(0) } 42% { transform: translateX(15px) } 50% { transform: translateX(13px) } 58% { transform: translateX(15px) } 80%,100% { transform: translateX(0) } }
@keyframes zap { 0%,38% { opacity: 0; transform: scale(.3) rotate(-10deg) } 46%,54% { opacity: 1; transform: scale(1.5) rotate(12deg) } 66%,100% { opacity: 0; transform: scale(.6) rotate(30deg) } }
@keyframes led { 0%,40%,66%,100% { fill: #475569 } 46%,52%,58% { fill: #FACC15 } 49%,55% { fill: #475569 } }
#pl { animation: push 2s ease-in-out infinite } #zp { transform-box: fill-box; transform-origin: center; animation: zap 2s ease-out infinite } #led { animation: led 2s linear infinite }
</style>
<rect x="210" y="82" width="26" height="58" rx="7" fill="#E2E8F0" stroke="#94A3B8" stroke-width="2"/>
<rect x="216" y="104" width="3" height="9" rx="1.5" fill="#334155"/><rect x="227" y="104" width="3" height="9" rx="1.5" fill="#334155"/>
<circle cx="223" cy="124" r="3" fill="#334155"/><circle id="led" cx="223" cy="92" r="3.5" fill="#475569"/>
<g id="pl"><path d="M150 168 C 178 168, 164 112, 186 109" fill="none" stroke="#1E293B" stroke-width="5" stroke-linecap="round"/>
<rect x="183" y="100" width="18" height="18" rx="4" fill="#64748B"/><rect x="186" y="103" width="5" height="12" rx="2" fill="#94A3B8"/>
<rect x="200" y="104" width="8" height="3" rx="1" fill="#CBD5E1"/><rect x="200" y="111" width="8" height="3" rx="1" fill="#CBD5E1"/></g>
<g id="zp"><path d="M212 88 L220 104 L211 106 L222 128 L203 103 L212 101 Z" fill="#FDE047" stroke="#F59E0B" stroke-width="1.5" stroke-linejoin="round"/>
<circle cx="199" cy="94" r="2.6" fill="#FDE047"/><circle cx="227" cy="96" r="2.2" fill="#FEF08A"/><circle cx="200" cy="124" r="2" fill="#FDE047"/><circle cx="226" cy="124" r="2.4" fill="#FDE047"/></g>
</svg>`;
const FRAMES = 12, STEP = 167; // 2 s de animación en bucle (12 cuadros y 48 colores: ~56 KB, caben las 12 poses)

// Chrome se queda abierto un minuto después de dibujar: arrancarlo es lo más lento, y las poses vienen seguidas.
let chrome = null, chromeIdle = null;
async function chromePage(base) {
  clearTimeout(chromeIdle);
  if (!chrome) chrome = (async () => {
    const { chromium } = await import('playwright-core');
    const browser = await chromium.launch({ executablePath: CHROME });
    const page = await browser.newPage({ viewport: { width: 240, height: 240 } });
    await page.goto(base + 'vendor/gsap.min.js'); // cualquier página del servidor, para poder importar /scene.js
    return { browser, page };
  })().catch(err => { chrome = null; throw err; });
  return chrome;
}
const chromeDone = () => {
  chromeIdle = setTimeout(() => { const c = chrome; chrome = null; c?.then(({ browser }) => browser.close()).catch(() => undefined); }, 60_000);
  chromeIdle.unref?.();
};

/** Dibuja la Nova cuadro a cuadro con el mismo scene.ts de la banda y la devuelve como GIF. */
async function renderGif(base, { mood, text, plug, palette, skin, mirror, size, label: showLabel }) {
  const gifenc = await import('gifenc');
  const { GIFEncoder, quantize, applyPalette } = gifenc.default ?? gifenc; // gifenc se publica como CommonJS
  try {
    const { page } = await chromePage(base);
    const label = text ?? CUBE_MOODS[mood];
    await page.evaluate(async ({ mood, label, skin, palette, mirror, size, plug, plugSvg }) => {
      const { scene } = await import('/scene.js');
      const { source } = scene([{ id: 'main', name: 'Nova', mood, palette, task: '', focus: '' }], { size: 190, now: 0, skin });
      document.documentElement.style.background = '#000';
      document.body.style.cssText = `margin:0;width:240px;height:240px;background:#000;display:flex;flex-direction:column;align-items:center;overflow:hidden;font:700 26px -apple-system,Helvetica,Arial,sans-serif;color:#E2E8F0`;
      // Con el enchufe, Nova se corre a la izquierda para dejarle sitio a la pared; el texto lleva puntos que se encienden.
      const dots = plug ? '<style>@keyframes dot { 0%,100% { opacity: .15 } 30%,70% { opacity: 1 } } #t i { font-style: normal; animation: dot 2s infinite } @keyframes jolt { 0%,44%,60%,100% { transform: none } 47% { transform: translate(-3px,-2px) } 50% { transform: translate(2px,1px) } 53% { transform: translate(-2px,0) } } #n svg { animation: jolt 2s linear infinite }</style><i>.</i><i style="animation-delay:.3s">.</i><i style="animation-delay:.6s">.</i>' : '';
      document.body.innerHTML = `<div id="n" style="flex:1;min-height:0;width:${plug ? 200 : 240}px;align-self:${plug ? 'flex-start' : 'center'};display:flex;align-items:center;justify-content:center">${source}</div>${label ? `<div id="t" style="height:36px;line-height:30px;white-space:nowrap">${label}${dots}</div>` : ''}${plugSvg}`;
      document.body.style.position = 'relative';
      // Un texto largo («Buscando a Claude…») se achica hasta caber en una línea.
      const t = document.getElementById('t');
      for (let px = 26; t && t.scrollWidth > 222 && px > 14; px--) t.style.fontSize = `${px}px`;
      // Recorta el dibujo a lo que se ve (la franja deja aire alrededor) y lo escala al hueco: «grande» lo llena.
      const svg = document.querySelector('#n svg'), b = svg.getBBox(), pad = Math.max(b.width, b.height) * 0.03;
      const room = document.getElementById('n').getBoundingClientRect();
      svg.setAttribute('viewBox', `${b.x - pad} ${b.y - pad} ${b.width + 2 * pad} ${b.height + 2 * pad}`);
      svg.setAttribute('width', String(room.width * size)); svg.setAttribute('height', String(room.height * size));
      document.body.style.transform = mirror ? 'scaleX(-1)' : ''; // el cristal lo vuelve a voltear
    }, { mood, label: showLabel ? label : '', skin, palette, mirror, size, plug: !!plug, plugSvg: plug ? PLUG : '' });
    const frames = [];
    for (let f = 0; f < FRAMES; f++) {
      await page.evaluate(t => document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }), f * STEP);
      const png = (await page.screenshot()).toString('base64');
      // Chrome mismo descodifica el PNG (así no hace falta otra librería) y lo devuelve en base64, que viaja rápido.
      frames.push(new Uint8Array(Buffer.from(await page.evaluate(async src => {
        const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
        const c = new OffscreenCanvas(240, 240), g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, 240, 240).data;
        let bin = '';
        for (let i = 0; i < d.length; i += 0x8000) bin += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
        return btoa(bin);
      }, png), 'base64')));
    }
    // Una paleta para todos los cuadros: no parpadea y pesa menos.
    const pal = quantize(frames[FRAMES >> 1], 48), gif = GIFEncoder();
    for (const fr of frames) gif.writeFrame(applyPalette(fr, pal), 240, 240, { palette: pal, delay: STEP });
    gif.finish();
    return Buffer.from(gif.bytes());
  } finally { chromeDone(); }
}

export function startCubo(view, prefsNow, claudeOpen, base, log) {
  let ip = null, shown = null, want = null, since = 0, sentAt = 0, busy = false, have = [], offName = null;
  // Con curl y no fetch: el cubo repite la cabecera Content-Length y Node rechaza esas respuestas.
  const curl = (args, ms = 4000) => new Promise((ok, fail) =>
    execFile('curl', ['-sf', '--max-time', String(ms / 1000), ...args], (err, out) => (err ? fail(err) : ok(out))));
  const get = p => curl([`http://${ip}/${p}`]);
  const list = async () => [...(await get('filelist?dir=/image/')).matchAll(/>((?:nova|nv)-[\w-]+\.gif)</g)].map(m => m[1]);

  /** Que el GIF esté en el cubo: si no, se dibuja, se hace sitio quitando el que lleva más sin usarse, y se sube. */
  const ensure = async (name, pick, keep) => {
    if (have.includes(name)) { have = [...have.filter(n => n !== name), name]; return; }
    const t0 = Date.now();
    const gif = await renderGif(base, pick);
    const drawn = Date.now();
    const free = async () => JSON.parse(await get('space.json')).free;
    // Se borra primero lo que no es del aspecto actual (otro color, otro tamaño…), el que lleva más sin usarse.
    const victim = () => have.find(n => !n.startsWith(keep) && n !== offName) ?? have.find(n => n !== shown && n !== offName);
    while (victim() && (have.length >= KEEP || (await free()) < gif.length + SPARE)) {
      const v = victim(); have = have.filter(n => n !== v);
      await get(`delete?file=${encodeURIComponent('/image/' + v)}`).catch(() => undefined);
    }
    if ((await free()) < gif.length + SPARE) throw new Error('el cubo está lleno: borra alguna foto desde su página');
    const tmp = path.join(os.tmpdir(), name);
    await fsp.writeFile(tmp, gif);
    try { await curl(['-F', `image=@${tmp};type=image/gif;filename=${name}`, `http://${ip}/doUpload?dir=/image/`], 30_000); }
    finally { await fsp.rm(tmp, { force: true }); }
    have.push(name);
    log(`cubo: dibujada ${pick.mood} (${pick.palette}, ${pick.skin}) en ${((drawn - t0) / 1000).toFixed(1)} s + subida ${((Date.now() - drawn) / 1000).toFixed(1)} s`);
  };

  // La primera vez con este cubo: guarda cómo estaba y lo deja en el álbum fijo (sin pasar fotos ni cambiar de tema).
  const setup = async conf => {
    if (!fs.existsSync(CHROME)) throw new Error(`no encuentro Chrome en ${CHROME} (pon su ruta en NOVA_CHROME)`);
    have = await list();
    if (!conf.antes) {
      conf.antes = { theme_list: JSON.parse(await get('theme_list.json')), album: JSON.parse(await get('album.json')) };
      await get(`set?theme_list=${conf.antes.theme_list.list}&sw_en=0&theme_interval=${conf.antes.theme_list.sw_i}`);
      await get(`set?i_i=${conf.antes.album.i_i}&autoplay=0`);
      await fsp.writeFile(CONF, JSON.stringify(conf, null, 2));
    }
    await get('set?theme=2'); // Photo Album
    log(`cubo listo en ${ip}`);
  };

  let ready = false, brt = null, retryAt = 0;
  setInterval(async () => {
    if (busy) return;
    // La dirección se puede cambiar o quitar en ⚙ Ajustes → 🧊 Cubo: se relee cada segundo.
    const conf = await fsp.readFile(CONF, 'utf8').then(JSON.parse).catch(() => ({}));
    if (conf.ip !== ip) { ip = conf.ip ?? null; ready = false; shown = null; brt = null; retryAt = 0; }
    if (!ip || Date.now() < retryAt) return;
    busy = true;
    try {
      if (!ready) { await setup(conf); ready = true; }
      const prefs = prefsNow();
      if (prefs.cubeBrt > 0 && prefs.cubeBrt !== brt) { await get(`set?brt=${prefs.cubeBrt}`); brt = prefs.cubeBrt; }
      const size = { chica: 0.7, mediana: 0.85, grande: 1 }[prefs.cubeSize] ?? 0.85; // parte del hueco que ocupa
      const look = { skin: prefs.skin || 'clasica', mirror: prefs.cubeMirror !== false, label: prefs.cubeLabel !== false, size };
      // El cubo corta los nombres a 20 letras: cómo se dibuja va como un código corto (nv-a1b2c3-trab.gif).
      const prefixOf = p => `nv-${crypto.createHash('md5').update(['v3', p.palette, p.skin, p.mirror, p.label, p.size].join('/')).digest('hex').slice(0, 6)}-`;
      const off = { ...look, ...OFFLINE, palette: prefs.color || 'nova' };
      offName = `${prefixOf(off)}conn.gif`;
      const open = claudeOpen();
      const pick = open ? { ...look, ...cuboPick(view(), prefs.cubeFollow) } : off;
      const prefix = prefixOf(pick);
      const name = open ? `${prefix}${pick.mood.slice(0, 4)}.gif` : offName;
      if (name !== want) { want = name; since = Date.now(); }
      // 1 s estable (no parpadea entre herramientas) y cada 5 min de nuevo, por si el cubo se reinició.
      if ((want !== shown && Date.now() - since >= 1000) || Date.now() - sentAt > 5 * 60_000) {
        await ensure(name, pick, prefix);
        await get(`set?img=${encodeURIComponent('/image/' + name)}`);
        if (name !== shown) log(`cubo: ${pick.mood} (${pick.palette}, ${pick.skin})`);
        shown = name; sentAt = Date.now();
      } else if (want === shown) {
        // Sin nada que cambiar: dibuja por adelantado otra pose de este aspecto, una por vuelta, para que luego salga al instante.
        const next = Object.keys(CUBE_MOODS).find(m => !have.includes(`${prefix}${m.slice(0, 4)}.gif`));
        if (open && next) await ensure(`${prefix}${next.slice(0, 4)}.gif`, { ...pick, mood: next }, prefix);
        else if (!have.includes(offName)) await ensure(offName, off, prefix); // la de «Buscando a Claude…», lista para cuando haga falta
      }
    } catch (err) { log(`cubo: ${err.message.split('\n')[0]}`); retryAt = Date.now() + 30_000; } // cubo apagado o fuera de la red
    busy = false;
  }, 1000).unref?.();

  /** Al apagarse el servidor: deja en el cubo a Nova buscando a Claude, para que no se quede congelado en una pose vieja. */
  return async function goodbye() {
    if (!ip || !offName || !have.includes(offName)) return;
    await get(`set?img=${encodeURIComponent('/image/' + offName)}`).then(() => log('cubo: conectando con Claude (servidor apagado)'), () => undefined);
  };
}
