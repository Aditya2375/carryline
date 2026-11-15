# carryline

A Java-first European Black-Scholes-Merton pricing worksheet with continuous dividend yield. Paired call/put model values, five Greeks with explicit units, an underlying-price sweep, expiry payoff comparison, parity arithmetic and a finite-volatility-change check.

This is a local educational model, not a quote, forecast, implied-volatility fit or recommendation. No feeds, accounts, trades, user-data storage or application dependencies. All amounts are per one underlying unit in an unspecified currency, with no contract multiplier. Read the [numerical contract](NUMERICS.md) for formulas, domains, approximation and model limits.

## Run locally

Java 21+, Node 22+, Python 3.10+. Browser checks also need Google Chrome as `google-chrome` on PATH. No runtime downloads.

```sh
javac -d build/classes src/carryline/*.java tools/*.java tests/carryline/*.java
java -cp build/classes carryline.TestRunner
node tests/parity.mjs
node tests/domain.mjs
python3 tests/reference.py
node tools/build-web.mjs
node tests/browser-smoke.mjs
python3 -m http.server 8000 --directory docs
```

Open http://localhost:8000. Use `JAVA=/path/to/java node tests/parity.mjs` for a custom Java executable. `SMOKE_SHOTS=1 node tests/browser-smoke.mjs` writes local screenshots. Smoke checks use local ports 8971/9372 and stop their child processes when finished.

## What the model assumes

European exercise only; constant volatility, continuously compounded rate and continuous dividend yield; frictionless continuous rebalancing and lognormal underlying dynamics. No early exercise, discrete dividends, jumps, stochastic parameters, funding spreads, taxes, fees or liquidity limits. Actual market prices differ. Nonzero minimum time 7 days and volatility 5% deliberately exclude singular expiry/zero-volatility Greeks.

Vega and rho are per +1 percentage point. Theta is the local derivative per calendar day elapsed, not the exact next-day price change. The payoff line is not profit and has a different time horizon from the model-value curve. A small parity residual is not independent validation, because parity constructs one of the prices. Independent erfc pricing and finite-difference tests are included.

## License

Original code, tests, documentation and charts are available under **MIT OR Apache-2.0**, at your option. See [LICENSE-MIT](LICENSE-MIT) and [LICENSE-APACHE](LICENSE-APACHE). No third-party runtime assets or market datasets are included. Sources are linked in NUMERICS.md.
