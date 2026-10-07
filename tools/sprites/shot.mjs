// Capture des sections de la planche des sprites, pour vérifier un rendu sans ouvrir de navigateur.
// Usage : [SCALE=3] node tools/sprites/shot.mjs <dossier> [section…]   (SCALE : zoom des captures)
// Sections : palette, maps, map (première carte), towers, creeps, states, scene. Par défaut : map et scene.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const [out, ...wanted] = process.argv.slice(2);
if (!out) {
  console.error('Usage : node tools/sprites/shot.mjs <dossier> [section…]');
  process.exit(1);
}
const SECTIONS = {
  palette: '#p-palette',
  maps: '#maps',
  map: '#maps figure >> nth=0',
  towers: '#p-towers',
  creeps: '#p-creeps',
  states: '#p-states',
  scene: '#scene',
};
const names = wanted.length ? wanted : ['map', 'scene'];

const server = await createServer({ logLevel: 'silent', server: { port: 5198, strictPort: false } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: Number(process.env.SCALE ?? 1) });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}sprites.html`);
  await page.waitForTimeout(4000);
  for (const name of names) {
    const sel = SECTIONS[name];
    if (!sel) throw new Error(`Section inconnue : ${name}`);
    const path = `${out}/${name}.png`;
    await page.locator(sel).screenshot({ path });
    console.log(path);
  }
  if (errors.length) console.error(`Erreurs de la page :\n${errors.join('\n')}`);
} finally {
  await browser.close();
  await server.close();
}
