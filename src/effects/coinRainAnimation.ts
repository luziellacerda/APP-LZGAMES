import type { AnimationObject } from "lottie-react-native";

// Shared native-vector templates: twelve coins, three designs, no bitmaps or downloads.
export const COIN_COUNT = 12;
export const COIN_FPS = 24;
export const COIN_FRAMES = 432;
type Shape = Record<string, unknown>;
const fixed = (k: unknown) => ({ a: 0, k });
const rgb = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
const transform = () => ({
  ty: "tr", p: fixed([0, 0]), a: fixed([0, 0]), s: fixed([100, 100]),
  r: fixed(0), o: fixed(100), sk: fixed(0), sa: fixed(0),
});

function animated(values: number[][], frames: number[], linear = false) {
  return {
    a: 1,
    k: values.map((s, index) => ({
      t: frames[index], s,
      ...(index < values.length - 1 ? {
        e: values[index + 1],
        o: { x: linear ? 0 : 0.42, y: 0 },
        i: { x: linear ? 1 : 0.58, y: 1 },
      } : {}),
    })),
  };
}

const ellipse = (radius: number, x = 0, y = 0): Shape => ({
  ty: "el", d: 1, p: fixed([x, y]), s: fixed([radius * 2, radius * 2]),
});
const path = (points: number[][], closed = true): Shape => ({
  ty: "sh", ks: fixed({ c: closed, v: points, i: points.map(() => [0, 0]), o: points.map(() => [0, 0]) }),
});
const fill = (hex: string, opacity = 100): Shape => ({ ty: "fl", c: fixed([...rgb(hex), 1]), o: fixed(opacity), r: 1 });
const stroke = (hex: string, width: number, opacity = 100): Shape => ({
  ty: "st", c: fixed([...rgb(hex), 1]), o: fixed(opacity), w: fixed(width), lc: 2, lj: 2,
});
const group = (name: string, items: Shape[]): Shape => ({ ty: "gr", nm: name, it: [...items, transform()] });
const painted = (name: string, shape: Shape, ...paints: Shape[]) => group(name, [shape, ...paints]);

function metallic(colors: string[]): Shape {
  const stops = [0, 0.38, 0.56, 1];
  return {
    ty: "gf", t: 1, r: 1, o: fixed(100), s: fixed([-19, -24]), e: fixed([23, 20]),
    g: { p: 4, k: fixed(colors.flatMap((color, index) => [stops[index], ...rgb(color)])) },
  };
}

function coinTemplate(variant: number): Shape {
  const palettes = [
    ["#9c570e", "#fff2ac", "#edb73d", "#92510b"],
    ["#aa680f", "#fff6cb", "#f9ce65", "#a06912"],
    ["#80500d", "#ffe59a", "#d99c2b", "#88500c"],
  ];
  const star = Array.from({ length: 10 }, (_, index) => {
    const angle = index * Math.PI / 5 - Math.PI / 2;
    const radius = index % 2 ? 4.4 : 9.2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
  const motifs = [star, [[0, -10], [8, 0], [0, 10], [-8, 0]], [[2, -11], [-7, 1], [-1, 1], [-3, 11], [7, -2], [1, -2]]];
  const body = [
    // Radial light fades out rather than drawing a hard halo around the coin.
    painted("Soft gold bloom", ellipse(30), {
      ty: "gf", t: 2, r: 1, o: fixed(100), s: fixed([0, 0]), e: fixed([30, 0]),
      g: { p: 2, k: fixed([0, ...rgb("#ffd270"), 1, ...rgb("#ffd270"), 0, 0.2, 0.7, 0.07, 1, 0]) },
    }),
    painted("Coin thickness", ellipse(23, 1.8, 1.5), fill("#74400b"), stroke("#d59b36", 1.2)),
    painted("Metal face", ellipse(22), metallic(palettes[variant]!), stroke("#ffe7a0", 1.15, 90)),
    painted("Recessed inner rim", ellipse(17.6), stroke("#75430c", 1.25, 88)),
    painted("Bevel highlight", ellipse(16.3, -0.2, -0.4), stroke("#fff1b9", 0.7, 55)),
    painted("Engraved game emblem", path(motifs[variant]!), fill("#8b5513", 86), stroke("#ffe69a", 0.6, 90)),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
      const angle = index * Math.PI / 4;
      return painted("Milled rim " + index, path([
        [Math.cos(angle) * 19.7, Math.sin(angle) * 19.7],
        [Math.cos(angle) * 21, Math.sin(angle) * 21],
      ], false), stroke("#885011", 0.8, 58));
    }),
  ];
  const glintFrames = [0, 48, 61, 72, 150, 164, 176, 270, 284, 296, COIN_FRAMES];
  const glintOpacity = [10, 10, 95, 10, 10, 80, 10, 10, 90, 10, 10];
  const base = (name: string, shapes: Shape[], opacity: unknown = fixed(100)): Shape => ({
    ty: 4, nm: name, sr: 1, ip: 0, op: COIN_FRAMES, st: 0, ddd: 0,
    ks: { p: fixed([32, 32, 0]), a: fixed([0, 0, 0]), s: fixed([100, 100, 100]), r: fixed(0), o: opacity },
    shapes: shapes.slice().reverse(),
  });
  return {
    id: "gold-coin-" + variant, w: 64, h: 64,
    layers: [
      { ...base("Moving specular glint", [
        painted("Warm reflected light", path([[-12, -23], [-10.5, -16.5], [-4, -15], [-10.5, -13.5], [-12, -7], [-13.5, -13.5], [-20, -15], [-13.5, -16.5]]), fill("#ffe79b", 24)),
        painted("Bright specular core", path([[-12, -21], [-11.3, -15.7], [-6, -15], [-11.3, -14.3], [-12, -9], [-12.7, -14.3], [-18, -15], [-12.7, -15.7]]), fill("#fff6d4", 96)),
      ], animated(glintOpacity.map((value) => [value]), glintFrames)), ind: 1 },
      { ...base("Embossed golden coin", body), ind: 2 },
    ],
  };
}

/** Native Lottie data, constructed only when the background's dimensions change. */
export function createCoinRainAnimation(width: number, height: number): AnimationObject {
  const w = Number.isFinite(width) ? Math.max(1, Math.round(width)) : 390;
  const h = Number.isFinite(height) ? Math.max(1, Math.round(height)) : 844;
  const margin = 58;
  const travel = h + margin * 2;
  const layers = Array.from({ length: COIN_COUNT }, (_, index) => {
    const phase = (index + 0.5) / COIN_COUNT;
    const wrap = Math.round((1 - phase) * COIN_FRAMES);
    const lane = (index * 7) % COIN_COUNT;
    const x = (lane + 0.5) * w / COIN_COUNT;
    const drift = (index % 2 ? 1 : -1) * Math.min(12, w * 0.025);
    const y = -margin + phase * travel;
    const size = [36, 28, 42, 31][index % 4]! * Math.min(1.2, Math.max(0.85, w / 390));
    const scale = size / 46 * 100;
    const spinFrames = Array.from({ length: 17 }, (_, step) => step * COIN_FRAMES / 16);
    const spin = spinFrames.map((_, step) => [
      scale * ((step + index) % 2 ? 0.16 : 1), scale, 100,
    ]);
    const alpha = [44, 29, 51, 35][index % 4]!;
    const tilt = (index % 3 - 1) * 12;
    return {
      ty: 0, ind: index + 1, nm: "Falling gold coin " + (index + 1), refId: "gold-coin-" + index % 3,
      w: 64, h: 64, sr: 1, ip: 0, op: COIN_FRAMES, st: 0, ddd: 0,
      ks: {
        p: animated([[x, y, 0], [x + drift, h + margin, 0], [x + drift, -margin, 0], [x, y, 0]], [0, wrap - 1, wrap, COIN_FRAMES], true),
        a: fixed([32, 32, 0]), s: animated(spin, spinFrames),
        r: animated([[tilt], [tilt + 12], [tilt], [tilt - 12], [tilt]], [0, 108, 216, 324, COIN_FRAMES]),
        // Each reset is invisible, with no cross-screen flash at the loop boundary.
        o: animated([[alpha], [alpha], [0], [0], [alpha], [alpha]], [0, wrap - 8, wrap - 2, wrap + 2, wrap + 8, COIN_FRAMES]),
      },
    };
  });
  return {
    v: "5.7.4", fr: COIN_FPS, ip: 0, op: COIN_FRAMES, w, h,
    nm: "LZ-GAMES · moedas douradas", ddd: 0,
    assets: [0, 1, 2].map(coinTemplate), layers,
  } as AnimationObject;
}
