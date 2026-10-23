// Builds the PNG and ICO icons from public/favicon.svg (Phase 12). Run: node scripts/generate-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(root, 'public/favicon.svg'));

const png32 = await sharp(svg, { density: 384 }).resize(32, 32).png().toBuffer();
await sharp(svg, { density: 1024 }).resize(180, 180).png().toFile(path.join(root, 'public/apple-touch-icon.png'));

// ICO container holding one 32x32 PNG image (supported by every current browser)
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // image count
header.writeUInt8(32, 6); // width
header.writeUInt8(32, 7); // height
header.writeUInt8(0, 8); // palette
header.writeUInt8(0, 9); // reserved
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png32.length, 14); // image size
header.writeUInt32LE(22, 18); // image offset
fs.writeFileSync(path.join(root, 'public/favicon.ico'), Buffer.concat([header, png32]));
console.log('Wrote public/favicon.ico and public/apple-touch-icon.png');
