// Original 64-point Gauss-Legendre integration of the standard-normal density.
const N = 64,
  X = [],
  W = [];
for (let i = 0; i < N / 2; i++) {
  let z = Math.cos((Math.PI * (i + 0.75)) / (N + 0.5)),
    der = 0;
  for (let k = 0; k < 30; k++) {
    let a = 1,
      b = z;
    for (let j = 2; j <= N; j++) {
      const t = ((2 * j - 1) * z * b - (j - 1) * a) / j;
      a = b;
      b = t;
    }
    der = (N * (z * b - a)) / (z * z - 1);
    const step = b / der;
    z -= step;
    if (Math.abs(step) < 2e-16) break;
  }
  let a = 1,
    b = z;
  for (let j = 2; j <= N; j++) {
    const t = ((2 * j - 1) * z * b - (j - 1) * a) / j;
    a = b;
    b = t;
  }
  der = (N * (z * b - a)) / (z * z - 1);
  X[i] = -z;
  X[N - 1 - i] = z;
  W[i] = W[N - 1 - i] = 2 / ((1 - z * z) * der * der);
}
export const density = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
export function cdf(x) {
  if (!Number.isFinite(x)) throw Error("Finite normal argument required.");
  if (x === 0) return 0.5;
  const a = Math.abs(x);
  if (a >= 12) return x < 0 ? 0 : 1;
  const mid = (a + 12) / 2,
    half = (12 - a) / 2;
  let sum = 0;
  for (let i = 0; i < N; i++) sum += W[i] * density(mid + half * X[i]);
  const tail = half * sum;
  return x < 0 ? tail : 1 - tail;
}
export const DEFAULT = {
  spot: 100,
  strike: 100,
  days: 90,
  volatility: 0.2,
  rate: 0.05,
  yield: 0.02,
};
export const LIMITS = {
  spot: [1, 1000],
  strike: [1, 1000],
  days: [7, 730],
  volatility: [0.05, 1.5],
  rate: [-0.05, 0.2],
  yield: [0, 0.15],
};
export function validate(p) {
  if (!p || typeof p !== "object") throw Error("Six finite inputs required.");
  for (const [k, [lo, hi]] of Object.entries(LIMITS))
    if (!Number.isFinite(p[k]) || p[k] < lo || p[k] > hi)
      throw Error(`${k}: use a value from ${lo} to ${hi} in model units.`);
}
export function price(p) {
  validate(p);
  const { spot: s, strike: k, days, volatility: sigma, rate: r, yield: q } = p,
    t = days / 365,
    root = Math.sqrt(t),
    v = sigma * root,
    d1 = (Math.log(s / k) + (r - q + 0.5 * sigma * sigma) * t) / v,
    d2 = d1 - v,
    dq = Math.exp(-q * t),
    dr = Math.exp(-r * t),
    a = s * dq,
    b = k * dr,
    diff = a - b;
  let cp, pp;
  if (diff >= 0) {
    pp = Math.max(0, b * cdf(-d2) - a * cdf(-d1));
    cp = pp + diff;
  } else {
    cp = Math.max(0, a * cdf(d1) - b * cdf(d2));
    pp = cp - diff;
  }
  const phi = density(d1),
    gamma = (dq * phi) / (s * v),
    vega = (a * phi * root) / 100,
    base = (-a * phi * sigma) / (2 * root);
  const call = {
    price: cp,
    delta: dq * cdf(d1),
    gamma,
    vega,
    theta: (base - r * b * cdf(d2) + q * a * cdf(d1)) / 365,
    rho: (k * t * dr * cdf(d2)) / 100,
  };
  const put = {
    price: pp,
    delta: -dq * cdf(-d1),
    gamma,
    vega,
    theta: (base + r * b * cdf(-d2) - q * a * cdf(-d1)) / 365,
    rho: (-k * t * dr * cdf(-d2)) / 100,
  };
  return { call, put, d1, d2, prepaid: a, bond: b, parity: cp - pp - (a - b) };
}
