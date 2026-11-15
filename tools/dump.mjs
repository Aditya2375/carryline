import { price, cdf } from "../web/src/model.js";
const cases = [];
for (const spot of [1, 50, 100, 150, 1000])
  for (const strike of [1, 100, 1000])
    for (const days of [7, 90, 365, 730])
      for (const volatility of [0.05, 0.2, 1.5])
        for (const rate of [-0.05, 0.05, 0.2])
          for (const yield_ of [0, 0.02, 0.15]) {
            const input = {
              spot,
              strike,
              days,
              volatility,
              rate,
              yield: yield_,
            };
            cases.push({ input, ...price(input) });
          }
console.log(
  JSON.stringify({
    cases,
    cdf: Array.from({ length: 2401 }, (_, i) => {
      const x = (i - 1200) / 100;
      return [x, cdf(x)];
    }),
  }),
);
