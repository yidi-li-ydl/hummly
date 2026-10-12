// Local alpha cleanup and frame alignment explicitly authorized by the user.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const states = ["curious-listening", "unhappy", "singing", "dancing", "group-dance", "cool-sunglasses", "headphones", "dj"];
const durations = [3, 2.5, 3.5, 2.8, 3.5, 3, 3, 3.5];
const tile = 384;
const out = path.join(root, "public/mascot/hummi/animations");
const sourceOut = path.join(root, "artifacts/hummi/animation-sources");
await mkdir(out, { recursive: true });
await mkdir(sourceOut, { recursive: true });

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

const report = [];
for (const state of states) {
  const source = path.join(root, "artifacts/hummi/animation-drafts", `${state}.png`);
  const meta = await sharp(source).metadata();
  const frames = [];
  for (let f = 0; f < 16; f++) {
    const x = f % 4, y = Math.floor(f / 4);
    const left = Math.round(x * meta.width / 4), top = Math.round(y * meta.height / 4);
    const width = Math.round((x + 1) * meta.width / 4) - left;
    const height = Math.round((y + 1) * meta.height / 4) - top;
    const { data } = await sharp(source).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const result = clean(data, width, height);
    frames.push({ ...result, width, height });
  }
  const maxWidth = Math.max(...frames.map(f => f.box.width));
  const maxHeight = Math.max(...frames.map(f => f.box.height));
  const scale = Math.min(tile * .80 / maxWidth, tile * .80 / maxHeight);
  const rendered = [];
  for (const frame of frames) {
    const width = Math.round(frame.box.width * scale), height = Math.round(frame.box.height * scale);
    const subject = await sharp(frame.data, { raw: { width: frame.width, height: frame.height, channels: 4 } })
      .extract(frame.box).resize(width, height).png().toBuffer();
    rendered.push(await sharp({ create: { width: tile, height: tile, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: subject, left: Math.round((tile - width) / 2), top: Math.round(tile * .90 - height) }]).png().toBuffer());
  }
  if (state === "dj") {
    // The generated jump pose crosses a cell boundary and omits the booth.
    // Use the complete raised-hand pose for the drop, keeping its booth planted.
    rendered[9] = rendered[8];
    const body = await sharp(rendered[11]).extract({ left: 0, top: 0, width: tile, height: 278 }).png().toBuffer();
    const booth = await sharp(rendered[11]).extract({ left: 0, top: 266, width: tile, height: tile - 266 }).png().toBuffer();
    const shiftedBody = await sharp(body).extract({ left: 0, top: 8, width: tile, height: 270 }).png().toBuffer();
    rendered[13] = await sharp({ create: { width: tile, height: tile, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: shiftedBody, left: 0, top: 0 }, { input: booth, left: 0, top: 266 }]).png().toBuffer();
  }
  // Singing must stay closed-eyed: replace the open-eyed middle poses with the
  // closed-eyed long-note poses, rather than painting or altering facial identity.
  const order = state === "singing" ? [0, 1, 2, 3, 9, 9, 10, 10, 11, 11, 12, 13, 14, 15, 0, 0] : Array.from({ length: 16 }, (_, i) => i);
  // An identical terminal frame guarantees a stable loop boundary.
  order[15] = order[0];
  const composite = order.map((f, i) => ({ input: rendered[f], left: i % 4 * tile, top: Math.floor(i / 4) * tile }));
  const atlas = sharp({ create: { width: tile * 4, height: tile * 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(composite);
  await atlas.clone().png().toFile(path.join(sourceOut, `${state}.png`));
  await atlas.clone().webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(out, `${state}.webp`));
  const rawFrames = await Promise.all(order.map(f => sharp(rendered[f]).ensureAlpha().raw().toBuffer()));
  await sharp(Buffer.concat(rawFrames), { raw: { width: tile, height: tile * 16, channels: 4, pageHeight: tile } })
    .webp({ quality: 88, alphaQuality: 100, loop: 0, delay: Math.round(durations[states.indexOf(state)] * 1000 / 16) })
    .toFile(path.join(out, `${state}-loop.webp`));
  // Contact sheet for checking edges on the app's actual dark surface.
  await sharp(await atlas.clone().png().toBuffer()).flatten({ background: "#0a0a0f" }).resize(1024, 1024).png().toFile(path.join(sourceOut, `${state}-contact.png`));
  report.push({ state, frames: 16, size: tile * 4, scale, loopFrameMatches: true, order });
}
await writeFile(path.join(sourceOut, "processing.json"), JSON.stringify(report, null, 2));
console.log("Prepared eight 16-frame transparent atlases.");
