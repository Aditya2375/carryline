import { DEFAULT, price } from "./model.js";
const $ = (s) => document.querySelector(s),
  put = (s, v) => ($(s).textContent = v);
let active = { ...DEFAULT },
  value = price(active),
  selected = 50;
const fmt = (x, n = 4) => {
  if (x === 0) return Number(0).toFixed(n);
  if (Math.abs(x) < 10 ** -n) return x.toExponential(2);
  return x.toLocaleString("en-US", {
    minimumFractionDigits: n,
    maximumFractionDigits: n,
  });
};
function cells(parent, values) {
  const tr = document.createElement("tr");
  for (const v of values) {
    const td = document.createElement("td");
    td.textContent = v;
    tr.append(td);
  }
  parent.append(tr);
}
const greekRows = [
  ["Delta", "delta", "price change / +1 underlying unit"],
  ["Gamma", "gamma", "delta change / +1 underlying unit"],
  ["Vega", "vega", "price change / +1 pp volatility"],
  ["Theta", "theta", "price change / 1 calendar day elapsed"],
  ["Rho", "rho", "price change / +1 pp risk-free rate"],
];
function sweep() {
  const side = $("#side").value,
    low = Math.max(1, active.spot * 0.5),
    high = Math.min(1000, active.spot * 1.5),
    spots = Array.from(
      { length: 101 },
      (_, i) => low + ((high - low) * i) / 100,
    ),
    points = spots.map((spot) => price({ ...active, spot })[side]),
    payoffs = spots.map((s) =>
      Math.max(side === "call" ? s - active.strike : active.strike - s, 0),
    ),
    spot = spots[selected],
    v = points[selected];
  put("#sweep-price", fmt(spot, 2));
  $("#cursor").setAttribute(
    "aria-valuetext",
    `Underlying ${fmt(spot, 2)} units`,
  );
  put("#sweep-value", fmt(v.price));
  put("#sweep-payoff", fmt(payoffs[selected]));
  put("#sweep-delta", fmt(v.delta));
  const svg = $("#chart");
  svg.replaceChildren();
  const ns = "http://www.w3.org/2000/svg",
    node = (tag, attrs, text) => {
      const n = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
      if (text !== undefined) n.textContent = text;
      return n;
    };
  const w = Math.max(230, svg.clientWidth),
    h = 270,
    L = 58,
    R = 10,
    T = 18,
    B = 32,
    iw = w - L - R,
    ih = h - T - B,
    hi = Math.max(0.001, ...points.map((p) => p.price), ...payoffs) * 1.12,
    x = (i) => L + (i / 100) * iw,
    y = (v) => T + (1 - v / hi) * ih;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  for (let j = 0; j <= 4; j++) {
    const v = (hi * j) / 4,
      yy = y(v);
    svg.append(
      node("line", { x1: L, x2: w - R, y1: yy, y2: yy, stroke: "#dde2df" }),
      node(
        "text",
        { x: L - 8, y: yy + 4, "text-anchor": "end" },
        fmt(v, hi < 0.01 ? 5 : 1),
      ),
    );
  }
  for (const i of [0, 50, 100])
    svg.append(
      node(
        "text",
        {
          x: x(i),
          y: h - 8,
          "text-anchor": i === 0 ? "start" : i === 100 ? "end" : "middle",
        },
        fmt(spots[i], 1),
      ),
    );
  const draw = (arr, color, dash) =>
    svg.append(
      node("path", {
        d: arr
          .map(
            (v, i) => (i ? "L" : "M") + x(i).toFixed(2) + "," + y(v).toFixed(2),
          )
          .join(" "),
        fill: "none",
        stroke: color,
        "stroke-width": 2,
        "stroke-dasharray": dash ? "5 4" : "none",
        "stroke-linejoin": "round",
      }),
    );
  draw(payoffs, "#896022", true);
  draw(
    points.map((p) => p.price),
    "#2b668b",
    false,
  );
  svg.append(
    node("line", {
      x1: x(selected),
      x2: x(selected),
      y1: T,
      y2: h - B,
      stroke: "#83959c",
      "stroke-dasharray": "3 4",
    }),
    node("circle", {
      cx: x(selected),
      cy: y(v.price),
      r: 4,
      fill: "#2b668b",
      stroke: "#fffef9",
      "stroke-width": 2,
    }),
  );
}
function render() {
  value = price(active);
  for (const side of ["call", "put"]) {
    const text = fmt(value[side].price);
    put(`#${side}-price`, text);
    $(`#${side}-price`).classList.toggle("long", text.length > 8);
  }
  const tbody = $("#greeks");
  tbody.replaceChildren();
  for (const [name, key, unit] of greekRows)
    cells(tbody, [name, unit, fmt(value.call[key], 6), fmt(value.put[key], 6)]);
  for (const [k, v] of Object.entries({
    "parity-left": value.call.price - value.put.price,
    prepaid: value.prepaid,
    bond: value.bond,
    residual: value.parity,
    time: active.days / 365,
    d1: value.d1,
    d2: value.d2,
  }))
    put("#" + k, fmt(v, k === "residual" ? 10 : 6));
  const shock = $("#shock-rows");
  shock.replaceChildren();
  if (active.volatility + 0.01 <= 1.5) {
    const next = price({ ...active, volatility: active.volatility + 0.01 });
    for (const side of ["call", "put"]) {
      const actual = next[side].price - value[side].price,
        estimate = value[side].vega;
      cells(shock, [
        side === "call" ? "Call" : "Put",
        fmt(estimate, 6),
        fmt(actual, 6),
        fmt(actual - estimate, 6),
      ]);
    }
    put(
      "#shock-note",
      "Compare a +1 percentage-point volatility change with the local vega estimate, holding the other assumptions fixed. The difference reflects curvature and numerical rounding.",
    );
  } else {
    cells(shock, ["Not evaluated", "-", "-", "-"]);
    put(
      "#shock-note",
      "A +1 percentage-point volatility change would exceed the supported 150% limit. Lower volatility to show this comparison.",
    );
  }
  sweep();
}
function read() {
  const p = {};
  for (const k of Object.keys(DEFAULT)) {
    const input = $("#" + k);
    if (!input.validity.valid || input.value.trim() === "")
      throw Error(
        `${input.closest("label").firstChild.textContent.trim()}: enter a value within the displayed range.`,
      );
    p[k] =
      Number(input.value) /
      (["volatility", "rate", "yield"].includes(k) ? 100 : 1);
  }
  price(p);
  return p;
}
$("#inputs").addEventListener("submit", (e) => {
  e.preventDefault();
  try {
    active = read();
    selected = 50;
    $("#cursor").value = "50";
    render();
    put(
      "#status",
      "Updated. All displayed results use these applied inputs, not market data.",
    );
  } catch (e) {
    put(
      "#status",
      `Not applied: ${e.message} Results still use the last applied inputs.`,
    );
  }
});
for (const k of Object.keys(DEFAULT))
  $("#" + k).addEventListener("input", () =>
    put(
      "#status",
      "Unapplied edits. Reprice contract to update all displayed results.",
    ),
  );
$("#reset").addEventListener("click", () => {
  active = { ...DEFAULT };
  for (const k of Object.keys(DEFAULT))
    $("#" + k).value = String(
      DEFAULT[k] * (["volatility", "rate", "yield"].includes(k) ? 100 : 1),
    );
  $("#side").value = "call";
  selected = 50;
  $("#cursor").value = "50";
  render();
  put(
    "#status",
    "Worksheet reset to illustrative defaults, not current market assumptions.",
  );
});
$("#side").addEventListener("change", sweep);
$("#cursor").addEventListener("input", () => {
  selected = +$("#cursor").value;
  sweep();
});
let resized;
window.addEventListener("resize", () => {
  clearTimeout(resized);
  resized = setTimeout(sweep, 100);
});
render();
