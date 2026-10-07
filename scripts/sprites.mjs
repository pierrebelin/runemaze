// Produit dist/sprites.html : la planche des sprites en un seul fichier, sans l'enveloppe
// <html>/<head>/<body>, pour une publication comme page hébergée qui fournit déjà ce squelette.
import { readFileSync, writeFileSync } from 'node:fs';
import { build } from 'vite';

await build({ logLevel: 'warn', build: { outDir: 'dist/sprites', emptyOutDir: true, rollupOptions: { input: 'sprites.html' } } });
const html = readFileSync('dist/sprites/sprites.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
writeFileSync('dist/sprites.html', `${head.trim()}\n${body.trim()}\n`);
console.log('dist/sprites.html écrit');
