import type { AnimationObject } from "lottie-react-native";
import { cometAnimation } from "./cometAnimation";

// Local vector assets: no downloads, bitmap sequences or expressions.
const fixed = (k: unknown) => ({ a: 0, k });
const color = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).concat(1);
type Shape = Record<string, unknown>;
const transform = {
  ty: "tr",
  p: fixed([0, 0]),
  a: fixed([0, 0]),
  s: fixed([100, 100]),
  r: fixed(0),
  o: fixed(100),
  sk: fixed(0),
  sa: fixed(0),
};
function keyframes(values: number[][], frames: number[], linear = false) {
  return {
    a: 1,
    k: values.map((s, i) => ({
      t: frames[i],
      s,
      ...(i < values.length - 1
        ? {
            e: values[i + 1],
            o: { x: linear ? 0 : 0.42, y: 0 },
            i: { x: linear ? 1 : 0.58, y: 1 },
          }
        : {}),
    })),
  };
}
const rect = (x: number, y: number, w: number, h: number, r = 3): Shape => ({
  ty: "rc",
  d: 1,
  p: fixed([x, y]),
  s: fixed([w, h]),
  r: fixed(r),
});
const ellipse = (x: number, y: number, w: number, h = w): Shape => ({
  ty: "el",
  d: 1,
  p: fixed([x, y]),
  s: fixed([w, h]),
});
function path(points: number[][], closed = true): Shape {
  return {
    ty: "sh",
    ks: fixed({
      c: closed,
      v: points,
      i: points.map(() => [0, 0]),
      o: points.map(() => [0, 0]),
    }),
  };
}
function paint(
  shape: Shape,
  fill?: string,
  stroke?: string,
  width = 1.5,
  opacity = 100,
): Shape {
  return {
    ty: "gr",
    it: [
      shape,
      ...(fill
        ? [{ ty: "fl", c: fixed(color(fill)), o: fixed(opacity), r: 1 }]
        : []),
      ...(stroke
        ? [
            {
              ty: "st",
              c: fixed(color(stroke)),
              o: fixed(opacity),
              w: fixed(width),
              lc: 2,
              lj: 2,
            },
          ]
        : []),
      transform,
    ],
  };
}
function layer(
  name: string,
  shapes: Shape[],
  motion: { float?: boolean; rotate?: number; pulse?: boolean } = {},
  frames = 120,
): Shape {
  return {
    ty: 4,
    nm: name,
    sr: 1,
    ip: 0,
    op: frames,
    st: 0,
    ddd: 0,
    ks: {
      p: motion.float
        ? keyframes(
            [
              [48, 49, 0],
              [48, 45, 0],
              [48, 49, 0],
            ],
            [0, 60, 120],
          )
        : fixed([48, 48, 0]),
      a: fixed([48, 48, 0]),
      s: fixed([100, 100, 100]),
      r: motion.rotate
        ? keyframes(
            [[-motion.rotate], [motion.rotate], [-motion.rotate]],
            [0, 60, 120],
          )
        : fixed(0),
      o: motion.pulse
        ? keyframes([[40], [100], [40]], [0, 60, 120])
        : fixed(100),
    },
    // Bodymovin paints the first group last; author our shapes back-to-front.
    shapes: shapes.slice().reverse(),
  };
}
function animation(
  name: string,
  layers: Shape[],
  w = 96,
  h = 96,
  frames = 120,
): AnimationObject {
  return {
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: frames,
    w,
    h,
    nm: name,
    ddd: 0,
    assets: [],
    layers: layers
      .slice()
      .reverse()
      .map((l, i) => ({ ...l, ind: i + 1 })),
  };
}
const highlight = (x: number, y: number) =>
  paint(
    path(
      [
        [x - 4, y],
        [x + 4, y],
      ],
      false,
    ),
    undefined,
    "#dcfff6",
    2,
  );

export const iconAnimations = {
  home: animation("LZ • Central", [
    layer(
      "Glass home",
      [
        paint(
          path([
            [18, 44],
            [48, 17],
            [78, 44],
            [69, 44],
            [69, 75],
            [27, 75],
            [27, 44],
          ]),
          "#174d43",
          "#65ffbd",
          2,
        ),
        paint(
          path(
            [
              [29, 44],
              [48, 26],
              [66, 44],
            ],
            false,
          ),
          undefined,
          "#d1ffee",
          2,
        ),
        paint(rect(48, 61, 16, 27, 2), "#092922", "#7bffd0", 1),
        highlight(60, 51),
      ],
      { float: true },
    ),
  ]),
  tools: animation("LZ • Assistência", [
    layer(
      "Steel tool",
      [
        paint(
          path([
            [24, 17],
            [36, 24],
            [34, 36],
            [57, 60],
            [64, 59],
            [75, 70],
            [70, 79],
            [60, 80],
            [49, 69],
            [50, 62],
            [27, 40],
            [17, 39],
            [12, 29],
            [13, 20],
            [23, 29],
            [28, 26],
          ]),
          "#278272",
          "#83ffcd",
          2,
        ),
        paint(
          path(
            [
              [34, 39],
              [58, 64],
            ],
            false,
          ),
          undefined,
          "#d9fff0",
          3,
        ),
        paint(ellipse(64, 71, 6), "#072b25", "#a5ffe3", 1),
        paint(
          path([
            [66, 15],
            [80, 29],
            [75, 34],
            [61, 20],
          ]),
          "#698ba6",
          "#c8e9ff",
          1.5,
        ),
        paint(
          path(
            [
              [65, 27],
              [44, 49],
            ],
            false,
          ),
          undefined,
          "#95b8cc",
          5,
        ),
      ],
      { rotate: 5 },
    ),
    layer("Inspection glint", [highlight(66, 16)], { pulse: true }),
  ]),
  calendar: animation("LZ • Agenda", [
    layer(
      "Calendar body",
      [
        paint(rect(48, 51, 58, 58, 9), "#143e61", "#81ddff", 2),
        paint(rect(48, 34, 55, 20, 6), "#288cb8"),
        paint(
          path(
            [
              [22, 43],
              [74, 43],
            ],
            false,
          ),
          undefined,
          "#b7f2ff",
          1,
        ),
        ...[33, 63].map((x) => paint(rect(x, 24, 6, 17, 3), "#dcf8ff")),
        ...[32, 45, 58].flatMap((x) =>
          [53, 65].map((y) => paint(rect(x, y, 5, 5, 1), "#75b7d1")),
        ),
      ],
      { float: true },
    ),
    layer(
      "Confirmed",
      [
        paint(ellipse(69, 70, 26), "#4bffc9", "#caffef", 1),
        paint(
          path(
            [
              [62, 70],
              [67, 75],
              [76, 65],
            ],
            false,
          ),
          undefined,
          "#093b32",
          3,
        ),
      ],
      { pulse: true },
    ),
  ]),
  rocket: animation("LZ • Nave", [
    layer(
      "Ion exhaust",
      [
        paint(
          path([
            [39, 67],
            [43, 89],
            [48, 94],
            [53, 89],
            [57, 67],
          ]),
          "#3175ba",
        ),
        paint(
          path([
            [43, 68],
            [46, 85],
            [48, 90],
            [50, 85],
            [53, 68],
          ]),
          "#72dfff",
        ),
        paint(
          path([
            [46, 68],
            [48, 83],
            [50, 68],
          ]),
          "#e2fbff",
        ),
      ],
      { pulse: true },
    ),
    layer(
      "Spacecraft",
      [
        paint(
          path([
            [35, 48],
            [21, 67],
            [21, 78],
            [38, 68],
          ]),
          "#5778be",
          "#99bcff",
          1.5,
        ),
        paint(
          path([
            [61, 48],
            [75, 67],
            [75, 78],
            [58, 68],
          ]),
          "#3e59a0",
          "#99bcff",
          1.5,
        ),
        paint(
          path([
            [48, 8],
            [60, 25],
            [64, 46],
            [59, 67],
            [37, 67],
            [32, 46],
            [36, 25],
          ]),
          "#c4d9ed",
          "#f0faff",
          1.5,
        ),
        paint(
          path([
            [48, 10],
            [59, 27],
            [63, 46],
            [58, 66],
            [48, 66],
          ]),
          "#6e88b8",
        ),
        paint(ellipse(48, 38, 18), "#103958", "#8defff", 3),
        paint(ellipse(45, 35, 6), "#d7faff"),
        paint(rect(48, 67, 23, 6, 2), "#345272", "#86b9e6", 1),
      ],
      { float: true },
    ),
  ]),
  trophy: animation("LZ • Sorteios", [
    layer(
      "Gold cup",
      [
        paint(
          path(
            [
              [29, 28],
              [15, 28],
              [18, 44],
              [34, 49],
            ],
            false,
          ),
          undefined,
          "#ebad46",
          5,
        ),
        paint(
          path(
            [
              [67, 28],
              [81, 28],
              [78, 44],
              [62, 49],
            ],
            false,
          ),
          undefined,
          "#d49030",
          5,
        ),
        paint(
          path([
            [27, 20],
            [69, 20],
            [65, 47],
            [56, 57],
            [40, 57],
            [31, 47],
          ]),
          "#f2bc53",
          "#ffecad",
          1.5,
        ),
        paint(
          path([
            [48, 22],
            [67, 22],
            [63, 47],
            [54, 55],
            [48, 55],
          ]),
          "#c28432",
        ),
        paint(rect(48, 64, 9, 16, 1), "#edb34f"),
        paint(rect(48, 77, 37, 9, 3), "#876ab7", "#c6aeff", 1.5),
        paint(
          path(
            [
              [34, 26],
              [37, 43],
            ],
            false,
          ),
          undefined,
          "#fff3c5",
          3,
        ),
        paint(
          path([
            [48, 29],
            [51, 37],
            [58, 37],
            [53, 42],
            [55, 49],
            [48, 45],
            [41, 49],
            [43, 42],
            [38, 37],
            [45, 37],
          ]),
          "#fff1b0",
        ),
      ],
      { rotate: 3 },
    ),
    layer(
      "Winner sparkle",
      [
        highlight(78, 15),
        paint(
          path(
            [
              [78, 11],
              [78, 19],
            ],
            false,
          ),
          undefined,
          "#fff0bf",
          2,
        ),
      ],
      { pulse: true },
    ),
  ]),
  user: animation("LZ • Conta", [
    layer(
      "Profile",
      [
        paint(rect(48, 48, 62, 70, 13), "#173b37", "#83ffcf", 1.5),
        paint(ellipse(48, 36, 23), "#a0e7d3", "#d4fff0", 1.5),
        paint(
          path([
            [27, 72],
            [29, 59],
            [39, 53],
            [57, 53],
            [67, 59],
            [69, 72],
          ]),
          "#458f83",
          "#a3efdb",
          1.5,
        ),
        paint(
          path(
            [
              [30, 69],
              [65, 69],
            ],
            false,
          ),
          undefined,
          "#d4fff0",
          1,
        ),
      ],
      { float: true },
    ),
    layer(
      "Account signal",
      [paint(ellipse(73, 20, 13), "#53f6a7", "#effff8", 1)],
      { pulse: true },
    ),
  ]),
};
export type AnimatedIconName = keyof typeof iconAnimations;

// Rear three-quarter view: swept wings, a glass canopy and twin ion engines.
// Independent local asset for the TurboRama viewport, not a video/download.
export const cruiserAnimation = animation(
  "LZ • Cruzeiro espacial",
  [
    layer(
      "Twin ion drives",
      [
        ...[84, 156].flatMap((x) => [
          paint(ellipse(x, 120, 22, 44), "#246db9", undefined, 1, 22),
          paint(
            path([
              [x - 7, 104],
              [x - 4, 133],
              [x, 143],
              [x + 4, 133],
              [x + 7, 104],
            ]),
            "#409fdf",
            undefined,
            1,
            65,
          ),
          paint(
            path([
              [x - 3, 104],
              [x, 131],
              [x + 3, 104],
            ]),
            "#d8fbff",
          ),
        ]),
      ],
      { pulse: true },
    ),
    layer("Cruiser hull", [
      paint(
        path([
          [111, 66],
          [65, 73],
          [17, 105],
          [76, 103],
          [103, 118],
          [120, 112],
          [137, 118],
          [164, 103],
          [223, 105],
          [175, 73],
          [129, 66],
        ]),
        "#273e5d",
        "#709fbf",
        1,
      ),
      paint(
        path([
          [113, 59],
          [74, 71],
          [29, 99],
          [81, 95],
          [108, 102],
        ]),
        "#87a8be",
      ),
      paint(
        path([
          [127, 59],
          [166, 71],
          [211, 99],
          [159, 95],
          [132, 102],
        ]),
        "#54718e",
      ),
      paint(
        path(
          [
            [79, 72],
            [48, 91],
            [93, 83],
          ],
          false,
        ),
        undefined,
        "#d4edf6",
        1.5,
      ),
      paint(
        path(
          [
            [161, 72],
            [192, 91],
            [147, 83],
          ],
          false,
        ),
        undefined,
        "#93c8df",
        1.5,
      ),
      ...[84, 156].map((x) =>
        paint(rect(x, 98, 18, 16, 3), "#112a43", "#91d0ec", 1.3),
      ),
      ...[84, 156].map((x) =>
        paint(rect(x, 106, 12, 4, 1), "#d5faff", "#52d8ff", 2),
      ),
      paint(
        path([
          [120, 20],
          [132, 51],
          [141, 91],
          [133, 108],
          [120, 116],
          [107, 108],
          [99, 91],
          [108, 51],
        ]),
        "#9db6c9",
        "#def4ff",
        1,
      ),
      paint(
        path([
          [120, 22],
          [130, 52],
          [139, 91],
          [132, 106],
          [120, 113],
        ]),
        "#4d688a",
      ),
      paint(
        path([
          [120, 41],
          [129, 65],
          [127, 79],
          [113, 79],
          [111, 65],
        ]),
        "#092b46",
        "#71ddff",
        1,
      ),
      paint(
        path(
          [
            [119, 46],
            [116, 66],
            [118, 75],
          ],
          false,
        ),
        undefined,
        "#cef4ff",
        1.5,
      ),
      paint(
        path(
          [
            [120, 85],
            [120, 107],
          ],
          false,
        ),
        undefined,
        "#d8f6ff",
        1,
      ),
      paint(
        path(
          [
            [39, 97],
            [67, 82],
          ],
          false,
        ),
        undefined,
        "#63dfff",
        2,
      ),
      paint(
        path(
          [
            [201, 97],
            [173, 82],
          ],
          false,
        ),
        undefined,
        "#63dfff",
        2,
      ),
    ]),
  ],
  240,
  160,
);

// Material shading is limited to the ship. Existing menu icons keep their colors.
// Layered gradients give the hull volume and the canopy an optical reflection.
const shipMaterials: Record<
  string,
  { stops: [number, string][]; start: number[]; end: number[] }
> = {
  "#273e5d": {
    stops: [
      [0, "#17263c"],
      [0.45, "#536d87"],
      [1, "#101d30"],
    ],
    start: [90, 70],
    end: [125, 122],
  },
  "#87a8be": {
    stops: [
      [0, "#e0f2fb"],
      [0.25, "#7594aa"],
      [0.52, "#b7d3df"],
      [0.73, "#557387"],
      [1, "#25394e"],
    ],
    start: [54, 66],
    end: [93, 109],
  },
  "#54718e": {
    stops: [
      [0, "#bbcfdc"],
      [0.24, "#7898af"],
      [0.58, "#304b68"],
      [0.88, "#69869d"],
      [1, "#1b3048"],
    ],
    start: [183, 63],
    end: [150, 112],
  },
  "#9db6c9": {
    stops: [
      [0, "#eef8ff"],
      [0.24, "#8aa9c2"],
      [0.48, "#c2d5e2"],
      [0.72, "#68849f"],
      [1, "#314962"],
    ],
    start: [104, 24],
    end: [124, 116],
  },
  "#4d688a": {
    stops: [
      [0, "#8bafc9"],
      [0.3, "#38546e"],
      [0.7, "#607d9c"],
      [1, "#102238"],
    ],
    start: [120, 25],
    end: [140, 115],
  },
  "#092b46": {
    stops: [
      [0, "#bcefff"],
      [0.17, "#286382"],
      [0.37, "#091c34"],
      [0.7, "#143450"],
      [0.78, "#639bb4"],
      [0.84, "#285471"],
      [1, "#051021"],
    ],
    start: [111, 44],
    end: [130, 80],
  },
};
for (const hullLayer of cruiserAnimation.layers) {
  if (hullLayer.nm !== "Cruiser hull") continue;
  for (const group of hullLayer.shapes) {
    const index = group.it.findIndex((item: Shape) => item.ty === "fl");
    if (index < 0) continue;
    const fill = group.it[index];
    const material = Object.entries(shipMaterials).find(([hex]) =>
      color(hex).every((v, i) => Math.abs(v - fill.c.k[i]) < 0.001),
    )?.[1];
    if (!material) continue;
    group.it[index] = {
      ty: "gf",
      nm: "Hull optical shading",
      o: fill.o,
      r: 1,
      t: 1,
      s: fixed(material.start),
      e: fixed(material.end),
      g: {
        p: material.stops.length,
        k: fixed(
          material.stops.flatMap(([stop, hex]) => [
            stop,
            ...color(hex).slice(0, 3),
          ]),
        ),
      },
    };
  }
}

function electricOutline(w: number, h: number, radius: number): Shape {
  const inset = 4.5;
  const r = Math.max(2, Math.min(radius - 2, (w - 9) / 2, (h - 9) / 2));
  const right = w - inset,
    bottom = h - inset;
  const points: number[][] = [];
  function edge(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    nx: number,
    ny: number,
  ) {
    const count = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 3));
    for (let i = 0; i < count; i++) {
      const t = i / count,
        jitter = i === 0 ? 0 : i % 2 ? 1.15 : -0.55;
      points.push([
        x1 + (x2 - x1) * t + nx * jitter,
        y1 + (y2 - y1) * t + ny * jitter,
      ]);
    }
  }
  function corner(x: number, y: number, angle: number) {
    for (let i = 0; i <= 6; i++) {
      const a = angle + (i * Math.PI) / 12;
      points.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
  }
  edge(inset + r, inset, right - r, inset, 0, 1);
  corner(right - r, inset + r, -Math.PI / 2);
  edge(right, inset + r, right, bottom - r, -1, 0);
  corner(right - r, bottom - r, 0);
  edge(right - r, bottom, inset + r, bottom, 0, -1);
  corner(inset + r, bottom - r, Math.PI / 2);
  edge(inset, bottom - r, inset, inset + r, 1, 0);
  corner(inset + r, inset + r, Math.PI);
  return path(points);
}

// Preserve the approved electric fallback. Ordinary cards use cometAnimation.
export const laserTrailProfile = Array.from({ length: 9 }, (_, index) => ({
  start: 60 - (index + 1) * 4,
  end: 60 - index * 4 + 0.15,
  opacity: Math.round(94 * Math.exp(-index * 0.38)),
}));

/** Moving light with a fading afterimage, wide bloom and reflective bevel. */
export function laserAnimation(
  w: number,
  h: number,
  radius: number,
  tint: string,
  electric = false,
): AnimationObject {
  if (!electric) return cometAnimation(w, h, radius, tint);
  const duration = electric ? 96 : 180;
  const rim = rect(w / 2, h / 2, w - 5, h - 5, radius);
  const trim = {
    ty: "tm",
    s: fixed(0),
    e: fixed(60),
    o: keyframes([[0], [360]], [0, duration], true),
    m: 1,
  };
  const groups: Shape[] = [
    {
      ty: "gr",
      it: [
        rim,
        {
          ty: "st",
          c: fixed(color(tint)),
          o: fixed(30),
          w: fixed(1),
          lc: 2,
          lj: 2,
        },
        transform,
      ],
    },
    // Broad, soft light spill under the moving core; never a filled card overlay.
    ...[
      [20, 7],
      [12, 15],
      [6, 29],
    ].map(([width, opacity]) => ({
      ty: "gr",
      it: [
        rim,
        {
          ty: "st",
          c: fixed(color(tint)),
          o: fixed(opacity),
          w: fixed(width),
          lc: 2,
          lj: 2,
        },
        { ...trim, s: fixed(28) },
        transform,
      ],
    })),
    // Bevel: lit top/left, dark underside. Gradient stroke leaves center clear.
    {
      ty: "gr",
      it: [
        rect(w / 2, h / 2, w - 9, h - 9, Math.max(2, radius - 2)),
        {
          ty: "gs",
          t: 1,
          o: fixed(65),
          w: fixed(1),
          lc: 2,
          lj: 2,
          s: fixed([0, 0]),
          e: fixed([w, h]),
          g: {
            p: 4,
            k: fixed([
              0, 0.72, 0.92, 0.86, 0.35, 0.15, 0.32, 0.3, 0.56, 0.015, 0.03,
              0.04, 1, 0.02, 0.045, 0.06,
            ]),
          },
        },
        transform,
      ],
    },
    ...laserTrailProfile.flatMap(({ start, end, opacity }) => [
      {
        ty: "gr",
        it: [
          rim,
          {
            ty: "st",
            c: fixed(color(tint)),
            o: fixed(opacity * 0.42),
            w: fixed(5),
            lc: 2,
            lj: 2,
          },
          { ...trim, s: fixed(start), e: fixed(end) },
          transform,
        ],
      },
      {
        ty: "gr",
        it: [
          rim,
          {
            ty: "st",
            c: fixed(color(tint)),
            o: fixed(opacity),
            w: fixed(1.9),
            lc: 2,
            lj: 2,
          },
          { ...trim, s: fixed(start), e: fixed(end) },
          transform,
        ],
      },
    ]),
    {
      ty: "gr",
      it: [
        rim,
        {
          ty: "st",
          c: fixed(color("#f2fffb")),
          o: fixed(100),
          w: fixed(0.95),
          lc: 2,
          lj: 2,
        },
        { ...trim, s: fixed(57.5), e: fixed(60) },
        transform,
      ],
    },
  ];
  if (electric) {
    groups.push({
      ty: "gr",
      it: [
        electricOutline(w, h, radius),
        {
          ty: "st",
          c: fixed(color("#d9fff5")),
          o: fixed(85),
          w: fixed(0.85),
          lc: 2,
          lj: 2,
        },
        {
          ...trim,
          e: fixed(25),
          o: keyframes([[20], [380]], [0, duration], true),
        },
        transform,
      ],
    });
    // Broken electric filaments: visible in the rim, never over button labels.
    groups.push({
      ty: "gr",
      it: [
        rect(w / 2, h / 2, w - 9, h - 9, Math.max(2, radius - 2)),
        {
          ty: "st",
          c: fixed(color("#e3fbff")),
          o: keyframes([[20], [85], [35], [85], [20]], [0, 24, 48, 72, 96]),
          w: fixed(1),
          lc: 2,
          lj: 2,
          d: [
            { n: "d", nm: "Dash", v: fixed(3) },
            { n: "g", nm: "Gap", v: fixed(6) },
            { n: "o", nm: "Offset", v: fixed(0) },
          ],
        },
        {
          ...trim,
          e: fixed(11),
          o: keyframes([[160], [520]], [0, duration], true),
        },
        transform,
      ],
    });
  }
  const outline = layer("Perimeter laser", groups, {}, duration);
  outline.ks = {
    p: fixed([0, 0, 0]),
    a: fixed([0, 0, 0]),
    s: fixed([100, 100, 100]),
    r: fixed(0),
    o: fixed(100),
  };
  return animation(
    electric ? "Electric menu" : "Laser card",
    [outline],
    w,
    h,
    duration,
  );
}
