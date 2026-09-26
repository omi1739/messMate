/**
 * Verify the demo screenshots are real renders, not blank frames.
 *
 * Decodes each PNG (Chrome writes 8-bit non-interlaced RGB/RGBA), un-filters the
 * scanlines and reports colour diversity, the dominant colour, and whether the
 * frame is light or dark. A blank or failed capture collapses to one flat colour
 * with near-zero diversity, which is what this catches.
 */
import { readdirSync, readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join } from "node:path";

const DIR = "public/demo";

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let pos = 8;
  let width, height, bitDepth, colorType, interlace;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`unexpected bit depth ${bitDepth}`);
  if (interlace !== 0) throw new Error("interlaced PNG unsupported");
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : null;
  if (!channels) throw new Error(`unsupported colour type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default: throw new Error(`bad filter ${filter}`);
      }
      cur[x] = v & 0xff;
    }
  }
  return { width, height, channels, pixels: out };
}

function analyse({ width, height, channels, pixels }) {
  const counts = new Map();
  let sampled = 0;
  let lumSum = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 220));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = y * width * channels + x * channels;
      // Quantise to 16 levels per channel so anti-aliasing does not inflate counts.
      const key =
        ((pixels[i] >> 4) << 8) | ((pixels[i + 1] >> 4) << 4) | (pixels[i + 2] >> 4);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      lumSum += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
      sampled++;
    }
  }

  let dominant = 0;
  for (const n of counts.values()) if (n > dominant) dominant = n;

  // Mean luminance across the whole frame identifies the theme. A single
  // corner pixel cannot: the auth screens put a full-height teal panel on the
  // left, so their top-left pixel is dark even though the theme is light.
  const meanLum = lumSum / sampled;

  const corner = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      const i = (y * width + x) * channels;
      corner.push(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    }
  }

  return {
    distinct: counts.size,
    dominantShare: dominant / sampled,
    meanLum,
    corner: corner[0],
  };
}

let failures = 0;
console.log("file                     size     dims        colours  ink     mean-lum  mode");
for (const file of readdirSync(DIR).filter((f) => f.endsWith(".png")).sort()) {
  const buf = readFileSync(join(DIR, file));
  const img = decodePng(buf);
  const a = analyse(img);

  // A page is legitimately mostly background, so "blank" means a flat frame
  // with essentially no ink. The 404 screen is sparse by design (a heading and
  // two links) and still measures ~1%, so the bar has to sit below that.
  const ink = 1 - a.dominantShare;
  const blank = ink < 0.002 || a.distinct < 8;
  const mode = a.meanLum > 120 ? "light" : a.meanLum < 70 ? "DARK" : "mixed?";
  if (blank) failures++;
  if (mode === "DARK") failures++;
  if (mode === "mixed?") failures++;

  console.log(
    `  ${file.padEnd(22)} ${String(Math.round(buf.length / 1024)).padStart(4)}KB  ` +
      `${`${img.width}x${img.height}`.padEnd(11)} ${String(a.distinct).padStart(5)}    ` +
      `${(ink * 100).toFixed(1).padStart(5)}%    ` +
      `${a.meanLum.toFixed(0).padStart(5)}     ${mode}${blank ? "  <-- NO CONTENT" : ""}`,
  );
}

console.log(
  failures
    ? `\n${failures} problem(s): blank frames or an unexpected colour scheme.`
    : "\nevery frame has real content and rendered in the light theme.",
);
process.exit(failures ? 1 : 0);
