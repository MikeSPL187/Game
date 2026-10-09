/** Small deterministic PRNG (mulberry32) and value-noise helpers. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number) { return t * t * (3 - 2 * t); }

export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

export function pick<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

export function randInt(rnd: () => number, min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}

/**
 * Precomputed tileable fBm noise (size×size, power of two) with fast bilinear sampling.
 * Used for purely visual texturing where calling fbm() per pixel would be too slow.
 */
export function noiseTile(seed: number, size = 256, octaves = 4, period = 8): (x: number, y: number) => number {
  const data = new Float32Array(size * size);
  // tileable value noise: lattice wraps every `p` cells
  const tv = (ix: number, iy: number, p: number, s: number) => hash2(((ix % p) + p) % p, ((iy % p) + p) % p, s);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0, amp = 0.5, norm = 0, p = period;
      for (let o = 0; o < octaves; o++) {
        const fx = (x / size) * p, fy = (y / size) * p;
        const xi = Math.floor(fx), yi = Math.floor(fy);
        const u = fx - xi, v = fy - yi;
        const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
        const a = tv(xi, yi, p, seed + o), b = tv(xi + 1, yi, p, seed + o), c = tv(xi, yi + 1, p, seed + o), d = tv(xi + 1, yi + 1, p, seed + o);
        sum += (a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv) * amp;
        norm += amp; amp *= 0.5; p *= 2;
      }
      data[y * size + x] = sum / norm;
    }
  }
  const m = size - 1;
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const x0 = xi & m, y0 = yi & m, x1 = (x0 + 1) & m, y1 = (y0 + 1) & m;
    const a = data[y0 * size + x0], b = data[y0 * size + x1], c = data[y1 * size + x0], d = data[y1 * size + x1];
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  };
}
