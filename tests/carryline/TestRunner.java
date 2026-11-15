package carryline;

public class TestRunner {
  static int n = 0;

  static void ok(boolean b) {
    n++;
    if (!b) throw new AssertionError("check" + n);
  }

  static void near(double a, double b, double e) {
    ok(Math.abs(a - b) <= e);
  }

  public static void main(String[] args) {
    near(Engine.cdf(0), .5, 0);
    near(Engine.cdf(1.96), .9750021048517795, 2e-15);
    near(Engine.cdf(-8), 6.220960574271784e-16, 1e-28);
    var p = new Engine.Inputs(100, 100, 365, .2, .05, 0);
    var v = Engine.price(p);
    near(v.call().price(), 10.450583572185565, 2e-12);
    near(v.put().price(), 5.573526022256971, 2e-12);
    near(v.call().delta(), .6368306511756191, 2e-14);
    near(v.call().gamma(), .018762017345846895, 2e-14);
    near(v.call().vega(), .3752403469169379, 2e-14);
    for (double s : new double[] {1, 80, 100, 120, 1000})
      for (double k : new double[] {1, 100, 1000})
        for (double d : new double[] {7, 90, 730})
          for (double vol : new double[] {.05, .2, 1.5})
            for (double r : new double[] {-.05, .05, .2})
              for (double q : new double[] {0, .02, .15}) {
                var z = Engine.price(new Engine.Inputs(s, k, d, vol, r, q));
                double a = z.prepaid(), b = z.bond();
                near(z.call().price() - z.put().price(), a - b, 1e-10);
                ok(z.call().price() >= Math.max(0, a - b) - 1e-10 && z.call().price() <= a + 1e-10);
                ok(z.put().price() >= Math.max(0, b - a) - 1e-10 && z.put().price() <= b + 1e-10);
                near(z.call().delta() - z.put().delta(), Math.exp(-q * d / 365), 1e-13);
                ok(
                    z.call().gamma() >= 0
                        && z.call().vega() >= 0
                        && z.put().rho() <= 0
                        && z.call().rho() >= 0);
                near(z.call().gamma(), z.put().gamma(), 0);
                near(z.call().vega(), z.put().vega(), 0);
              }
    for (double[] x :
        new double[][] {
          {0, 100, 90, .2, .05, 0},
          {100, 100, 0, .2, .05, 0},
          {100, 100, 90, 0, .05, 0},
          {Double.NaN, 100, 90, .2, .05, 0},
          {100, 100, 90, .2, .21, 0},
          {100, 100, 90, .2, .05, -.01}
        }) {
      boolean bad = false;
      try {
        Engine.price(new Engine.Inputs(x[0], x[1], x[2], x[3], x[4], x[5]));
      } catch (IllegalArgumentException e) {
        bad = true;
      }
      ok(bad);
    }
    System.out.println(n + " Java checks passed");
  }
}
