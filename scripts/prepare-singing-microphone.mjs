// Prepare the ImageGen microphone edit for the existing 96-cell player.
// Preserve intact key poses; tween only scale and position to avoid ghost hands.
import sharp from "sharp";
import path from "node:path";
import { writeFile } from "node:fs/promises";
const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public/mascot/hummi/animations");
const source = path.join(root, "artifacts/hummi/microphone/singing-microphone-generated.png");
function clean(data, width, height) {
  const count = width * height;
  const mask = new Uint8Array(count);
  for (let p = 0; p < count; p++) {
    const i = p * 4;
    const [r, g, b, a] = data.subarray(i, i + 4);
    const white = r > 244 && g > 244 && b > 244 && Math.max(r, g, b) - Math.min(r, g, b) < 8;
    const yellow = r > 195 && g > 185 && b < 100;
    const red = r > 190 && g < 100 && b < 100;
    if (a > 8 && !white && !yellow && !red) mask[p] = 1;
  }
  const labels = new Int32Array(count);
  const queue = new Int32Array(count);
  let label = 0, largest = 0, maxCount = 0;
  for (let p = 0; p < count; p++) {
    if (!mask[p] || labels[p]) continue;
    label++;
    let head = 0, tail = 1;
    queue[0] = p; labels[p] = label;
    while (head < tail) {
      const at = queue[head++], x = at % width;
      for (const next of [x > 0 ? at - 1 : -1, x < width - 1 ? at + 1 : -1, at - width, at + width]) {
        if (next >= 0 && next < count && mask[next] && !labels[next]) {
          labels[next] = label; queue[tail++] = next;
        }
      }
    }
    if (tail > maxCount) { maxCount = tail; largest = label; }
  }
  if (maxCount < count * .05) throw new Error("No complete character component found");
  const keep = new Uint8Array(count);
  for (let p = 0; p < count; p++) keep[p] = labels[p] === largest ? 1 : 0;
  // Restore tiny enclosed highlight holes; never fill the spaces between beams.
  const seen = new Uint8Array(count);
  for (let p = 0; p < count; p++) {
    if (keep[p] || seen[p]) continue;
    let head = 0, tail = 1, boundary = false;
    queue[0] = p; seen[p] = 1;
    while (head < tail) {
      const at = queue[head++], x = at % width, y = Math.floor(at / width);
      if (!x || x === width - 1 || !y || y === height - 1) boundary = true;
      for (const next of [x > 0 ? at - 1 : -1, x < width - 1 ? at + 1 : -1, at - width, at + width]) {
        if (next >= 0 && next < count && !keep[next] && !seen[next]) { seen[next] = 1; queue[tail++] = next; }
      }
    }
    // Small interior highlights and facial details belong to the character.
    // Large negative spaces inside the connected group beams remain transparent.
    if (!boundary && tail <= 1200) for (let n = 0; n < tail; n++) keep[queue[n]] = 1;
  }
  let left = width, top = height, right = 0, bottom = 0;
  for (let p = 0; p < count; p++) {
    if (!keep[p]) { data[p * 4 + 3] = 0; continue; }
    const x = p % width, y = Math.floor(p / width);
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return { data, box: { left, top, width: right - left + 1, height: bottom - top + 1 }, kept: maxCount };
}

const meta = await sharp(source).metadata();
const keys = [];
for (let i = 0; i < 16; i++) {
  const left = Math.round(i % 4 * meta.width / 4), top = Math.round(Math.floor(i / 4) * meta.height / 4);
  const width = Math.round((i % 4 + 1) * meta.width / 4) - left;
  const height = Math.round((Math.floor(i / 4) + 1) * meta.height / 4) - top;
  const data = await sharp(source).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer();
  keys.push({ ...clean(data, width, height), width, height });
}
// Close on the same complete pose, rather than a changed hand or mouth.
keys[15] = keys[0];
const size = 256;
const scale = Math.min(size * .80 / Math.max(...keys.map(k => k.box.width)), size * .80 / Math.max(...keys.map(k => k.box.height)));
const frames = [], rawFrames = [];
for (let i = 0; i < 96; i++) {
  const idx = Math.floor(i / 6), t = i % 6 / 6;
  const a = keys[idx], b = keys[(idx + 1) % 16], pose = t < .5 ? a : b;
  const width = Math.round((a.box.width * (1 - t) + b.box.width * t) * scale);
  const height = Math.round((a.box.height * (1 - t) + b.box.height * t) * scale);
  const subject = await sharp(pose.data, { raw: { width: pose.width, height: pose.height, channels: 4 } }).extract(pose.box).resize(width, height).png().toBuffer();
  const frame = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: subject, left: Math.round((size - width) / 2), top: Math.round(size * .90 - height) }]).png().toBuffer();
  frames.push(frame);
  rawFrames.push(await sharp(frame).ensureAlpha().raw().toBuffer());
}
const atlas = sharp({ create: { width: size * 8, height: size * 12, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(frames.map((input, i) => ({ input, left: i % 8 * size, top: Math.floor(i / 8) * size })));
await atlas.webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(out, "singing-microphone-v1.webp"));
await sharp(Buffer.concat(rawFrames), { raw: { width: size, height: size * 96, channels: 4, pageHeight: size } }).webp({ quality: 90, alphaQuality: 100, loop: 0, delay: 36 }).toFile(path.join(out, "singing-microphone-v1-loop.webp"));
await sharp(frames[0]).resize(768, 768).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(root, "public/mascot/hummi/singing-microphone-v1.webp"));
await sharp({ create: { width: size * 4, height: size * 4, channels: 4, background: "#fff9f0" } }).composite(Array.from({length:16}, (_, i) => ({input:frames[i*6],left:i%4*size,top:Math.floor(i/4)*size}))).png().toFile(path.join(root,"artifacts/hummi/microphone/contact.png"));
await writeFile(path.join(root, "artifacts/hummi/microphone/README.md"), `# Singing with microphone\n\nBuilt-in ImageGen edit of the existing Singing 16-pose atlas. Prompt: preserve HUMMI and all poses; add a small purple-black handheld microphone with silver mesh head, gripped by the front hand near the mouth; transparent background; no other changes.\n\nThe generated matte flecks are removed using the existing connected-component cleanup. The 96-cell atlas tweens the scale and position of intact key poses, without limb morphing. Duration: 3.5 seconds. Original Singing assets remain available.\n`);
console.log("Prepared microphone atlas, animated WebP, static accessibility fallback and contact sheet.");
