import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { price, cdf } from "../web/src/model.js";
const java = process.env.JAVA || "java",
  lines = execFileSync(java, ["-cp", "build/classes", "Dump"], {
    maxBuffer: 12e6,
  })
    .toString()
    .trim()
    .split("\n");
let n = 0,
  max = 0;
for (const line of lines) {
  const t = line.split(",").map(Number),
    [spot, strike, days, volatility, rate, yield_] = t,
    p = { spot, strike, days, volatility, rate, yield: yield_ },
    z = price(p),
    actual = [
      ...["call", "put"].flatMap((side) =>
        ["price", "delta", "gamma", "vega", "theta", "rho"].map(
          (k) => z[side][k],
        ),
      ),
      z.d1,
      z.d2,
      z.prepaid,
      z.bond,
      z.parity,
    ];
  actual.forEach((v, j) => {
    const e = Math.abs(v - t[j + 6]) / Math.max(1, Math.abs(t[j + 6]));
    max = Math.max(max, e);
    assert.ok(e < 2e-12, `case ${t.slice(0, 6)} ${j} ${e}`);
    n++;
  });
}
for (const line of execFileSync(java, ["-cp", "build/classes", "Dump", "cdf"])
  .toString()
  .trim()
  .split("\n")) {
  const [x, v] = line.split(",").map(Number);
  assert.ok(Math.abs(cdf(x) - v) < 2e-15);
  n++;
}
console.log(`${n} Java/JS values, max normalized option error ${max}`);
