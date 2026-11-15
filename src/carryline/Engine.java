package carryline;

/** Independent European BSM implementation, continuous yield, per underlying unit. */
public final class Engine {
  public record Inputs(
      double spot, double strike, double days, double volatility, double rate, double yield) {}

  public record Option(
      double price, double delta, double gamma, double vega, double theta, double rho) {}

  public record Value(
      Option call, Option put, double d1, double d2, double prepaid, double bond, double parity) {}

  private static final int N = 64;
  private static final double[] X = new double[N], W = new double[N];

  static {
    for (int i = 0; i < N / 2; i++) {
      double z = Math.cos(Math.PI * (i + .75) / (N + .5)), der = 0;
      for (int k = 0; k < 30; k++) {
        double a = 1, b = z;
        for (int j = 2; j <= N; j++) {
          double t = ((2 * j - 1) * z * b - (j - 1) * a) / j;
          a = b;
          b = t;
        }
        der = N * (z * b - a) / (z * z - 1);
        double step = b / der;
        z -= step;
        if (Math.abs(step) < 2e-16) break;
      }
      // Recompute derivative at the accepted root, not the preceding iterate.
      double a = 1, b = z;
      for (int j = 2; j <= N; j++) {
        double t = ((2 * j - 1) * z * b - (j - 1) * a) / j;
        a = b;
        b = t;
      }
      der = N * (z * b - a) / (z * z - 1);
      X[i] = -z;
      X[N - 1 - i] = z;
      W[i] = W[N - 1 - i] = 2 / ((1 - z * z) * der * der);
    }
  }

  public static double density(double x) {
    return Math.exp(-.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  public static double cdf(double x) {
    if (!Double.isFinite(x)) throw new IllegalArgumentException("finite normal argument required");
    if (x == 0) return .5;
    double a = Math.abs(x);
    if (a >= 12) return x < 0 ? 0 : 1;
    double mid = (a + 12) / 2, half = (12 - a) / 2, sum = 0;
    for (int i = 0; i < N; i++) sum += W[i] * density(mid + half * X[i]);
    double tail = half * sum;
    return x < 0 ? tail : 1 - tail;
  }

  public static void validate(Inputs p) {
    double[] v = {p.spot(), p.strike(), p.days(), p.volatility(), p.rate(), p.yield()};
    double[] lo = {1, 1, 7, .05, -.05, 0}, hi = {1000, 1000, 730, 1.5, .2, .15};
    for (int i = 0; i < v.length; i++)
      if (!Double.isFinite(v[i]) || v[i] < lo[i] || v[i] > hi[i])
        throw new IllegalArgumentException("Input outside supported domain");
  }

  public static Value price(Inputs p) {
    if (p == null) throw new IllegalArgumentException("inputs");
    validate(p);
    double s = p.spot(),
        k = p.strike(),
        t = p.days() / 365,
        sigma = p.volatility(),
        r = p.rate(),
        q = p.yield(),
        root = Math.sqrt(t),
        v = sigma * root,
        d1 = (Math.log(s / k) + (r - q + .5 * sigma * sigma) * t) / v,
        d2 = d1 - v;
    double dq = Math.exp(-q * t),
        dr = Math.exp(-r * t),
        a = s * dq,
        b = k * dr,
        diff = a - b,
        call,
        put;
    // Compute the forward-out-of-money side first to reduce cancellation in deep ITM cases.
    if (diff >= 0) {
      put = Math.max(0, b * cdf(-d2) - a * cdf(-d1));
      call = put + diff;
    } else {
      call = Math.max(0, a * cdf(d1) - b * cdf(d2));
      put = call - diff;
    }
    double phi = density(d1),
        gamma = dq * phi / (s * v),
        vega = a * phi * root / 100,
        base = -a * phi * sigma / (2 * root);
    Option c =
        new Option(
            call,
            dq * cdf(d1),
            gamma,
            vega,
            (base - r * b * cdf(d2) + q * a * cdf(d1)) / 365,
            k * t * dr * cdf(d2) / 100);
    Option z =
        new Option(
            put,
            -dq * cdf(-d1),
            gamma,
            vega,
            (base + r * b * cdf(-d2) - q * a * cdf(-d1)) / 365,
            -k * t * dr * cdf(-d2) / 100);
    return new Value(c, z, d1, d2, a, b, (call - put) - (a - b));
  }
}
