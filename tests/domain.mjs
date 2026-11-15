import assert from "node:assert/strict";
import { DEFAULT, LIMITS, price, cdf } from "../web/src/model.js";
let n = 0;
const test = (fn) => {
  fn();
  n++;
};
for (const [k, [lo, hi]] of Object.entries(LIMITS)) {
  for (const v of [
    NaN,
    Infinity,
    -Infinity,
    lo - 1,
    hi + 1,
    "100",
    null,
    undefined,
  ])
    test(() => assert.throws(() => price({ ...DEFAULT, [k]: v })));
  for (const v of [lo, hi])
    test(() => {
      const z = price({ ...DEFAULT, [k]: v });
      for (const side of ["call", "put"])
        for (const x of Object.values(z[side])) assert.ok(Number.isFinite(x));
    });
}
for (const p of [null, undefined, {}, "bad"])
  test(() => assert.throws(() => price(p)));
let prev = 0;
for (let i = -1200; i <= 1200; i++) {
  const x = i / 100;
  test(() => {
    const v = cdf(x);
    assert.ok(v >= prev - 1e-16 && v >= 0 && v <= 1);
    assert.ok(Math.abs(cdf(-x) - (1 - v)) < 2e-15);
    prev = v;
  });
}
for (const s of [1, 80, 100, 300, 1000])
  for (const k of [1, 100, 1000])
    for (const days of [7, 90, 730])
      for (const volatility of [0.05, 0.2, 1.5])
        test(() => {
          const p = { ...DEFAULT, spot: s, strike: k, days, volatility },
            z = price(p);
          assert.ok(z.call.price >= 0 && z.put.price >= 0);
          assert.ok(z.call.delta >= 0 && z.put.delta <= 0);
          if (s < 1000) {
            const higher = price({ ...p, spot: Math.min(1000, s + 1) });
            assert.ok(
              higher.call.price >= z.call.price - 2e-11 &&
                higher.put.price <= z.put.price + 2e-11,
            );
          }
        });
console.log(`${n} domain/normal-symmetry/monotonicity checks passed`);
