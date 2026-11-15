# Numerical contract

## Scope and inputs

One European vanilla call and put, same strike and expiry, on one underlying unit. All money values are in the same unspecified currency. No multiplier, paid premium, fees, market quote, implied-volatility solve or actual security. These are assumptions, not forecasts or recommended parameters.

Inputs: spot S and strike K in [1,1000]; time d in [7,730] calendar days; volatility sigma in [.05,1.5] annual decimal; continuously compounded risk-free rate r in [-.05,.20]; continuous annual dividend yield q in [0,.15]. The UI accepts volatility/rate/yield in percent, then divides by 100. A +1 percentage-point volatility move means sigma+.01, not sigma*1.01. All values must be finite; no zero-volatility or zero-time boundary pricing or Greeks. These deliberately bounded teaching domains are not market-wide validity claims.

T=d/365, with no calendar or day-count inference. Constant parameters, geometric-Brownian risk-neutral dynamics, frictionless continuous hedging and continuous yield. No discrete dividend amounts/dates, stochastic volatility/rates, jumps, spreads, fees, funding constraints, early exercise or liquidity limits. European exercise only. Actual market premiums are not determined by this worksheet. No expected physical-return/drift input is needed by the risk-neutral formula.

## Prices

v=sigma*sqrt(T)

d1=[ln(S/K)+(r-q+sigma²/2)T]/v; d2=d1-v

A=S*exp(-qT); B=K*exp(-rT)

C=A*Phi(d1)-B*Phi(d2); P=B*Phi(-d2)-A*Phi(-d1)

Phi is the standard-normal CDF, phi its density. To reduce deep in-the-money cancellation, compute the forward-out-of-money side first: if A>=B compute P directly and C=P+(A-B); otherwise compute C directly and P=C-(A-B). A tiny negative OTM price from cancellation is clamped to 0. Tails and very small values can round to 0, so relative accuracy is not guaranteed for tiny premiums. Model values below immediate payoff can occur, for example due to yield or negative rates, because this European model cannot exercise early.

Put-call parity: C-P=A-B. The displayed residual is arithmetic, not an independent accuracy check, since parity constructs one side. Tests compare both prices independently against Python libm erfc formulas. No-arbitrage model bounds: max(A-B,0)<=C<=A and max(B-A,0)<=P<=B.

## Greeks and displayed units

Delta is dV/dS, price units per +1 underlying-price unit, with other inputs fixed. Call=exp(-qT)Phi(d1); put=-exp(-qT)Phi(-d1). This is spot delta, not forward delta and not a physical exercise probability.

Gamma=d²V/dS²=exp(-qT)phi(d1)/(S*v), same for calls and puts. It measures delta change per +1 underlying-price unit.

Vega=(dV/dsigma)/100=A*phi(d1)*sqrt(T)/100, same for calls and puts, displayed per +1 percentage point of annual volatility.

Theta=-(dV/dT)/365, displayed per calendar day elapsed, a local derivative, not the exact repriced one-day change:
- call=[-A*phi(d1)*sigma/(2sqrt(T))-rB*Phi(d2)+qA*Phi(d1)]/365
- put=[-A*phi(d1)*sigma/(2sqrt(T))+rB*Phi(-d2)-qA*Phi(-d1)]/365

Rho=(dV/dr)/100, displayed per +1 percentage point of the continuously compounded rate: call=K*T*exp(-rT)*Phi(d2)/100; put=-K*T*exp(-rT)*Phi(-d2)/100.

Greeks are local derivatives. They do not promise the premium change for a finite move. Theta need not be negative. Gamma and vega are shared by calls and puts here. All unrounded arithmetic is double precision. Prices display 4 decimals, Greeks 6, parity residual 10; nonzero values too small for that precision use scientific notation. Exact/tail-rounded 0 is shown as 0. Formatting is not a claim of that many reliable significant digits in extreme tails.

## Normal CDF: original numerical quadrature

Density phi(x)=exp(-x²/2)/sqrt(2pi). For a=abs(x)<12, integrate phi from a to 12 using a 64-point Gauss-Legendre rule. Nodes are roots of P64 found by Newton iteration from cosine initial estimates. Pn uses the three-term Legendre recurrence; derivative uses n*(xPn-Pn-1)/(x²-1). Weights=2/[(1-x²)*(P64prime)²], recomputed at the accepted roots, symmetrically paired. Transform [-1,1] to [a,12]. Negative x returns this tail directly; positive x returns 1-tail; x=0 returns .5. At abs(x)>=12, return 0 or 1. The omitted tail beyond 12 is below 2e-33, but quadrature and floating-point error dominate absolute accuracy. There is no relative-tail accuracy guarantee or general-purpose probability-library claim.

This is an original implementation of a standard quadrature method, not redistributed third-party numerical source. Independent tests use Python math.erfc, not this quadrature. The tested normal grid is -12..12 in .01 steps, plus an option grid covering domains and shorter/longer tenors. Measured errors and checks are evidence for those cases, not a proof over all real inputs.

## Sweep and finite shock

The sweep holds K,T,sigma,r,q fixed, changes S over [max(1,.5S_applied),min(1000,1.5S_applied)] with 101 points. At clipped domain edges the middle point need not equal the applied spot. The selected sweep spot is printed explicitly. Expiry payoff is max(S-K,0) or max(K-S,0) without premium subtraction, not profit or a forecast. Payoff is at expiry; the model curve has the original nonzero remaining time. Both curves share price units but not a time horizon.

Volatility shock uses exact repricing at sigma+.01 minus the applied price, compared with displayed-unit vega. If sigma+.01>1.5 it is not evaluated, rather than clamped or extrapolated. Other parameters remain unchanged.

## State and privacy

Inputs are applied together only after valid form values and a full validated price calculation. Incomplete/out-of-range edits leave old results with an explicit unapplied/not-applied status. Chart side and cursor operate on the last applied contract. Reset restores arbitrary defaults 100 / 100 / 90 days / 20% vol / 5% r / 2% q. No upload, storage, telemetry, network requests or exports. A native browser may retain form history; page reset is not secure erasure of browser/device memory.

## Sources

- [Glyn Holton, Merton 1973 pricing and Greeks](https://www.glynholton.com/notes/merton_1973/), 2013: continuous-yield European formulas. Formula images visually checked; no images copied into the project.
- [Macroption, BSM formulas and units](https://www.macroption.com/black-scholes-formula/): spot Greeks, percent-point scaling, elapsed-time theta sign. Local derivative definition takes precedence over prose implying exact finite changes.
- [OIC, Black-Scholes Formula](https://www.optionseducation.org/advancedconcepts/black-scholes-formula): market prices and American early-exercise limitation.
- [OIC, Volatility and the Greeks](https://www.optionseducation.org/advancedconcepts/volatility-the-greeks): interpretation and units.
- [NIST normal distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3661.htm): density/CDF integral.
- [NIST DLMF 3.5](https://dlmf.nist.gov/3.5): Gauss-Legendre quadrature.

No code, datasets, figures, papers, logos or fonts from these sources are redistributed. All UI, engine, tests, documentation and charts are original. Continuous q is not a discrete-dividend approximation validated for any real contract.
