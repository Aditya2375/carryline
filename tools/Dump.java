import carryline.Engine;
import java.util.Locale;

public class Dump {
  public static void main(String[] args) {
    if (args.length > 0 && args[0].equals("cdf")) {
      for (int i = -1200; i <= 1200; i++) {
        double x = i / 100.0;
        System.out.printf(Locale.ROOT, "%.17g,%.17g%n", x, Engine.cdf(x));
      }
      return;
    }
    for (double s : new double[] {1, 50, 100, 150, 1000})
      for (double k : new double[] {1, 100, 1000})
        for (double d : new double[] {7, 90, 365, 730})
          for (double v : new double[] {.05, .2, 1.5})
            for (double r : new double[] {-.05, .05, .2})
              for (double q : new double[] {0, .02, .15}) {
                var p = new Engine.Inputs(s, k, d, v, r, q);
                var z = Engine.price(p);
                System.out.printf(
                    Locale.ROOT, "%.17g,%.17g,%.17g,%.17g,%.17g,%.17g", s, k, d, v, r, q);
                for (var o : new Engine.Option[] {z.call(), z.put()})
                  System.out.printf(
                      Locale.ROOT,
                      ",%.17g,%.17g,%.17g,%.17g,%.17g,%.17g",
                      o.price(),
                      o.delta(),
                      o.gamma(),
                      o.vega(),
                      o.theta(),
                      o.rho());
                System.out.printf(
                    Locale.ROOT,
                    ",%.17g,%.17g,%.17g,%.17g,%.17g%n",
                    z.d1(),
                    z.d2(),
                    z.prepaid(),
                    z.bond(),
                    z.parity());
              }
  }
}
