/**
 * Genera los iconos de la PWA y el favicon a partir del isotipo maestro
 * (`src/app/icon.svg`) — una sola fuente de verdad, sin arte duplicado.
 *
 *   npm run pwa:icons
 *
 * Salida en `public/`:
 *   favicon.ico                   → 16/32/48 px para la pestaña del navegador
 *
 * Salida en `public/icons/`:
 *   icon-{192,512}.png            → iconos "any" (el arte llena el lienzo)
 *   icon-maskable-{192,512}.png   → iconos "maskable" (arte al 76% para que
 *                                   Android pueda recortar en círculo, gota o
 *                                   squircle sin comerse el monograma)
 *   apple-touch-icon.png          → 180px, opaco, esquinas cuadradas (iOS las
 *                                   redondea solo)
 *
 * Los PNG se versionan en el repo: el build de Vercel no ejecuta este script.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "src/app/icon.svg");
const OUT_DIR = path.join(ROOT, "public/icons");
const PUBLIC_DIR = path.join(ROOT, "public");

/** Azul Marino Profundo — fondo de marca de todos los iconos. */
const NAVY = "#0d1f3c";

/**
 * La zona segura de un icono maskable es el círculo central del 80%. El
 * monograma ya vive holgado dentro del SVG, pero se reduce al 76% para
 * garantizar que ningún recorte agresivo toque el asta de las J.
 */
const MASKABLE_SCALE = 0.76;

interface IconSpec {
  file: string;
  size: number;
  /** Proporción del lienzo que ocupa el arte. 1 = a sangre. */
  scale: number;
}

/**
 * Tamaños que Windows, Chrome y los agregadores esperan dentro de un .ico.
 * Se mantienen los tres: el navegador elige el que le sirve y ninguno se
 * reescala a ojo desde otro.
 */
const FAVICON_SIZES = [16, 32, 48];

/**
 * El isotipo vive holgado dentro del SVG (≈21% de margen a cada lado). A
 * 512px eso se lee como aire; a 16px se lee como un cuadrado azul con una
 * mancha dorada. Para el favicon se recorta ese margen y el monograma llena
 * la pestaña.
 */
const FAVICON_ZOOM = 1.3;

const ICONS: IconSpec[] = [
  { file: "icon-192.png", size: 192, scale: 1 },
  { file: "icon-512.png", size: 512, scale: 1 },
  { file: "icon-maskable-192.png", size: 192, scale: MASKABLE_SCALE },
  { file: "icon-maskable-512.png", size: 512, scale: MASKABLE_SCALE },
  { file: "apple-touch-icon.png", size: 180, scale: 1 },
];

/**
 * Empaqueta varios PNG en un único .ico. El formato admite PNG crudo dentro
 * del contenedor desde Vista/IE11, que es más de lo que cualquier navegador
 * vivo necesita, así que no hace falta escribir BMP a mano.
 */
function buildIco(images: Array<{ size: number; png: Buffer }>): Buffer {
  const HEADER = 6;
  const ENTRY = 16;
  const header = Buffer.alloc(HEADER);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // 1 = icono
  header.writeUInt16LE(images.length, 4);

  let offset = HEADER + ENTRY * images.length;
  const entries: Buffer[] = [];
  for (const { size, png } of images) {
    const entry = Buffer.alloc(ENTRY);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // 0 significa 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // paleta: ninguna
    entry.writeUInt8(0, 3); // reservado
    entry.writeUInt16LE(1, 4); // planos
    entry.writeUInt16LE(32, 6); // bits por píxel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

async function generateFavicon(svg: Buffer) {
  const images: Array<{ size: number; png: Buffer }> = [];

  for (const size of FAVICON_SIZES) {
    const zoomed = Math.round(size * FAVICON_ZOOM);
    const left = Math.round((zoomed - size) / 2);

    // Dos pasadas a propósito: sharp aplica `extract` sobre el SVG ya
    // rasterizado a tamaño completo si va en el mismo pipeline que el
    // `resize`, y el recorte caía en una esquina vacía del lienzo.
    const rendered = await sharp(svg, { density: 512 })
      .resize(zoomed, zoomed, { fit: "contain", background: NAVY })
      .png()
      .toBuffer();

    const png = await sharp(rendered)
      .extract({ left, top: left, width: size, height: size })
      .png({ compressionLevel: 9 })
      .toBuffer();
    images.push({ size, png });
  }

  await writeFile(path.join(PUBLIC_DIR, "favicon.ico"), buildIco(images));
  console.log(`✓ public/favicon.ico  (${FAVICON_SIZES.join("/")} px)`);
}

async function main() {
  const svg = await readFile(SOURCE);
  await mkdir(OUT_DIR, { recursive: true });

  for (const { file, size, scale } of ICONS) {
    const art = Math.round(size * scale);

    // `density` alto antes de reescalar: sharp rasteriza el SVG una sola vez,
    // así que se rasteriza grande y se reduce, nunca al revés.
    const rendered = await sharp(svg, { density: 512 })
      .resize(art, art, { fit: "contain", background: NAVY })
      .png()
      .toBuffer();

    const canvas = sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: NAVY,
      },
    }).composite([{ input: rendered, gravity: "centre" }]);

    const png = await canvas.png({ compressionLevel: 9 }).toBuffer();
    await writeFile(path.join(OUT_DIR, file), png);
    console.log(`✓ public/icons/${file}  (${size}×${size}, arte ${art}px)`);
  }

  await generateFavicon(svg);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
