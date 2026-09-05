import type { AnimationObject } from "lottie-react-native";

type Shape = Record<string, unknown>;
const fixed = (k: unknown) => ({ a: 0, k });
const rgba = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const identity = {
  p: fixed([0, 0, 0]),
  a: fixed([0, 0, 0]),
  s: fixed([100, 100, 100]),
  r: fixed(0),
  o: fixed(100),
};
const groupTransform = { ty: "tr", ...identity, sk: fixed(0), sa: fixed(0) };

/** A single continuous opacity ramp, not repeated round-ended trail segments. */
export const cometOpacity = [
  0, 0, 0.16, 0.025, 0.36, 0.1, 0.57, 0.27, 0.78, 0.55, 0.94, 0.86, 1, 1,
];

export function cometPerimeter(w: number, h: number, radius: number) {
  const inset = 2.5,
    right = w - inset,
    bottom = h - inset;
  const r = Math.max(1, Math.min(radius, (w - 5) / 2, (h - 5) / 2));
  const a = w - 5 - r * 2,
    b = h - 5 - r * 2,
    arc = (Math.PI * r) / 2;
  const length = a * 2 + b * 2 + arc * 4;
  const breaks = [0];
  let distance = 0;
  [a, arc, b, arc, a, arc, b, arc].forEach((part, index) => {
    const steps = index % 2 ? 8 : 1;
    for (let j = 1; j <= steps; j++)
      breaks.push((distance + (part * j) / steps) / length);
    distance += part;
  });
  const tail =
    Math.min(
      length * 0.2,
      145,
      Math.max(14, Math.min(a, b) * 0.85 + r * 0.25),
    ) / length;
  const point = (unit: number): number[] => {
    let d = (((unit % 1) + 1) % 1) * length;
    if (d <= a) return [inset + r + d, inset];
    d -= a;
    const corner = (x: number, y: number, angle: number) => [
      x + Math.cos(angle + d / r) * r,
      y + Math.sin(angle + d / r) * r,
    ];
    if (d <= arc) return corner(right - r, inset + r, -Math.PI / 2);
    d -= arc;
    if (d <= b) return [right, inset + r + d];
    d -= b;
    if (d <= arc) return corner(right - r, bottom - r, 0);
    d -= arc;
    if (d <= a) return [right - r - d, bottom];
    d -= a;
    if (d <= arc) return corner(inset + r, bottom - r, Math.PI / 2);
    d -= arc;
    if (d <= b) return [inset, bottom - r - d];
    d -= b;
    return corner(inset + r, inset + r, Math.PI);
  };
  const k = r * 0.5522847498;
  const path = {
    c: true,
    v: [
      [inset + r, inset],
      [right - r, inset],
      [right, inset + r],
      [right, bottom - r],
      [right - r, bottom],
      [inset + r, bottom],
      [inset, bottom - r],
      [inset, inset + r],
    ],
    i: [
      [-k, 0],
      [0, 0],
      [0, -k],
      [0, 0],
      [k, 0],
      [0, 0],
      [0, k],
      [0, 0],
    ],
    o: [
      [0, 0],
      [k, 0],
      [0, 0],
      [0, k],
      [0, 0],
      [-k, 0],
      [0, 0],
      [0, -k],
    ],
  };
  return { point, path, tail, length, breaks };
}

export function cometAnimation(
  w: number,
  h: number,
  radius: number,
  tint: string,
): AnimationObject {
  const frames = 180,
    curve = cometPerimeter(w, h, radius);
  const keys = (values: number[][], times?: number[]) => ({
    a: 1,
    k: values.map((s, index) => ({
      t: frames * (times?.[index] ?? index / (values.length - 1)),
      s,
      ...(index < values.length - 1
        ? { e: values[index + 1], o: { x: 0, y: 0 }, i: { x: 1, y: 1 } }
        : {}),
    })),
  });
  // Key only straight endpoints and arc samples; native interpolation fills in.
  const times = [
    ...new Set([
      0,
      1,
      ...curve.breaks,
      ...curve.breaks.map((u) => (((u - curve.tail) % 1) + 1) % 1),
    ]),
  ]
    .sort((a, b) => a - b)
    .filter((u, i, all) => i === 0 || u - (all[i - 1] ?? u) > 0.0000001);
  const tailPoints = times.map((u) => curve.point(u));
  const headPoints = times.map((u) => curve.point(u + curve.tail));
  const rim = { ty: "sh", ks: fixed(curve.path) };
  const trim = {
    ty: "tm",
    s: fixed(0),
    e: fixed(curve.tail * 100),
    o: keys([[0], [360]]),
    m: 1,
  };
  const tintColor = rgba(tint);
  const gradient = (width: number, opacity: number, hot = false): Shape => ({
    ty: "gr",
    nm: hot ? "Continuous comet core" : "Continuous comet bloom",
    it: [
      rim,
      {
        ty: "gs",
        t: 1,
        o: fixed(opacity),
        w: fixed(width),
        lc: 1,
        lj: 2,
        s: keys(tailPoints, times),
        e: keys(headPoints, times),
        // Match color/alpha stop positions so SVG/native share one gradient.
        // Separate opacity masks can have an empty bounding box on straight edges.
        g: {
          p: cometOpacity.length / 2,
          k: fixed([
            ...cometOpacity.flatMap((position, i) =>
              i % 2
                ? []
                : [
                    position,
                    ...tintColor.map((channel, axis) => {
                      const blend = hot
                        ? Math.max(0, (position - 0.78) / 0.22)
                        : 0;
                      return (
                        channel * (1 - blend) + ([0.95, 1, 0.98][axis] ?? channel) * blend
                      );
                    }),
                  ],
            ),
            ...cometOpacity,
          ]),
        },
      },
      trim,
      groupTransform,
    ],
  });
  const groups: Shape[] = [
    {
      ty: "gr",
      nm: "Unlit rail",
      it: [
        rim,
        {
          ty: "st",
          c: fixed([...tintColor, 1]),
          o: fixed(16),
          w: fixed(0.7),
          lc: 2,
          lj: 2,
        },
        groupTransform,
      ],
    },
    {
      ty: "gr",
      nm: "Shaded bevel",
      it: [
        rim,
        {
          ty: "gs",
          t: 1,
          o: fixed(50),
          w: fixed(1),
          lc: 2,
          lj: 2,
          s: fixed([0, 0]),
          e: fixed([w, h]),
          g: {
            p: 3,
            k: fixed([
              0, 0.6, 0.8, 0.72, 0.45, 0.05, 0.15, 0.12, 1, 0.01, 0.025, 0.035,
            ]),
          },
        },
        groupTransform,
      ],
    },
    gradient(20, 12),
    gradient(11, 25),
    gradient(5, 48),
    gradient(1.7, 100, true),
  ];
  const halo = (diameter: number, opacity: number, hex: string): Shape => ({
    ty: "gr",
    it: [
      { ty: "el", d: 1, p: fixed([0, 0]), s: fixed([diameter, diameter]) },
      { ty: "fl", c: fixed([...rgba(hex), 1]), o: fixed(opacity), r: 1 },
      groupTransform,
    ],
  });
  const layer = (nm: string, shapes: Shape[], ks: Shape, ind: number) => ({
    ty: 4,
    nm,
    ind,
    sr: 1,
    ip: 0,
    op: frames,
    st: 0,
    ddd: 0,
    ks,
    shapes: shapes.slice().reverse(),
  });
  return {
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: frames,
    w,
    h,
    nm: "Continuous fading comet",
    ddd: 0,
    assets: [],
    layers: [
      layer(
        "Single light source",
        [halo(12, 8, tint), halo(6, 28, tint), halo(2, 100, "#f2fffb")],
        {
          ...identity,
          p: keys(
            headPoints.map((p) => [...p, 0]),
            times,
          ),
        },
        1,
      ),
      layer("One continuous fading trail", groups, identity, 2),
    ],
  };
}
