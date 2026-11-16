// A small PNG reader for the generators: 8-bit, non-interlaced greyscale, RGB,
// palette and RGBA images, which is what the art scripts write. No dependencies.

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

export class PNG {
  constructor(width, height, rgba) {
    this.width = width;
    this.height = height;
    this.rgba = rgba;
  }

  /** [r, g, b, a] at (x, y); transparent outside the image. */
  at(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return [0, 0, 0, 0];
    const i = (y * this.width + x) * 4;
    return [this.rgba[i], this.rgba[i + 1], this.rgba[i + 2], this.rgba[i + 3]];
  }

  static read(path) {
    const buf = readFileSync(path);
    let pos = 8;
    let width, height, depth, type, interlace;
    let palette = null;
    let alpha = null;
    const idat = [];
    while (pos < buf.length) {
      const length = buf.readUInt32BE(pos);
      const kind = buf.toString("ascii", pos + 4, pos + 8);
      const data = buf.subarray(pos + 8, pos + 8 + length);
      if (kind === "IHDR") {
        width = data.readUInt32BE(0);
        height = data.readUInt32BE(4);
        depth = data[8];
        type = data[9];
        interlace = data[12];
      } else if (kind === "PLTE") palette = data;
      else if (kind === "tRNS") alpha = data;
      else if (kind === "IDAT") idat.push(data);
      else if (kind === "IEND") break;
      pos += 12 + length;
    }
    if (depth !== 8 || interlace) throw new Error(`${path}: only 8-bit, non-interlaced PNGs are read`);
    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
    const raw = inflateSync(Buffer.concat(idat));
    const stride = width * channels;
    const pixels = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y++) {
      const filter = raw[y * (stride + 1)];
      const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
      for (let x = 0; x < stride; x++) {
        const left = x >= channels ? pixels[y * stride + x - channels] : 0;
        const up = y ? pixels[(y - 1) * stride + x] : 0;
        const corner = y && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
        let value = line[x];
        if (filter === 1) value += left;
        else if (filter === 2) value += up;
        else if (filter === 3) value += (left + up) >> 1;
        else if (filter === 4) {
          const p = left + up - corner;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - corner);
          value += pa <= pb && pa <= pc ? left : pb <= pc ? up : corner;
        }
        pixels[y * stride + x] = value & 255;
      }
    }
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const p = pixels.subarray(i * channels, (i + 1) * channels);
      let px;
      if (type === 6) px = [p[0], p[1], p[2], p[3]];
      else if (type === 2) px = [p[0], p[1], p[2], 255];
      else if (type === 0) px = [p[0], p[0], p[0], 255];
      else if (type === 4) px = [p[0], p[0], p[0], p[1]];
      else px = [palette[p[0] * 3], palette[p[0] * 3 + 1], palette[p[0] * 3 + 2], alpha && p[0] < alpha.length ? alpha[p[0]] : 255];
      rgba.set(px, i * 4);
    }
    return new PNG(width, height, rgba);
  }
}
