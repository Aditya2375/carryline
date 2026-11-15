import { spawn } from "node:child_process";
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  rmSync,
  mkdtempSync,
} from "node:fs";

const HTTP_PORT = 8971;
const CDP_PORT = 9372;
const SHOTS = process.env.SMOKE_SHOTS === "1";
const root = new URL("..", import.meta.url).pathname;

const profile = mkdtempSync("/tmp/carryline-chrome-");
const server = spawn(
  "python3",
  [
    "-m",
    "http.server",
    String(HTTP_PORT),
    "--bind",
    "127.0.0.1",
    "--directory",
    `${root}docs`,
  ],
  { stdio: "ignore", detached: true },
);
const chrome = spawn(
  "google-chrome",
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore", detached: true },
);

const cleanup = async (code) => {
  for (const child of [chrome, server]) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
  await Promise.all(
    [chrome, server].map((child) =>
      child.exitCode !== null
        ? Promise.resolve()
        : new Promise((r) => child.once("exit", r)),
    ),
  );
  rmSync(profile, { recursive: true, force: true });
  process.exit(code);
};
const timeout = setTimeout(() => {
  console.error("smoke: timeout");
  cleanup(1);
}, 90000);
process.on("SIGINT", () => cleanup(2));
process.on("uncaughtException", (e) => {
  console.error(e);
  cleanup(1);
});
process.on("unhandledRejection", (e) => {
  console.error(e);
  cleanup(1);
});

async function waitFor(fn, label, timeoutMs = 60000) {
  const start = Date.now();
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    if (Date.now() - start > timeoutMs)
      throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok, detail });
  console.log(
    `${ok ? "ok" : "NOT OK"} - ${name}${detail ? " - " + detail : ""}`,
  );
};

await waitFor(
  async () => (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok,
  "chrome devtools",
);
const target = await (
  await fetch(`http://127.0.0.1:${CDP_PORT}/json/new`, { method: "PUT" })
).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let mid = 0;
const rpcPending = new Map();
const consoleErrors = [];
const requests = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === "Network.requestWillBeSent")
    requests.push(msg.params.request.url);
  if (msg.id && rpcPending.has(msg.id)) {
    rpcPending.get(msg.id)(msg);
    rpcPending.delete(msg.id);
  } else if (msg.method === "Runtime.exceptionThrown")
    consoleErrors.push(
      msg.params.exceptionDetails?.exception?.description ?? "page exception",
    );
};
const cdp = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++mid;
    rpcPending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const res = await cdp("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.result?.exceptionDetails)
    throw new Error(JSON.stringify(res.result.exceptionDetails));
  return res.result?.result?.value;
};
const shot = async (name) => {
  if (!SHOTS) return;
  await new Promise((r) => setTimeout(r, 900));
  const metrics = await cdp("Page.getLayoutMetrics");
  const size = metrics.result.cssContentSize;
  const r = await cdp("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 },
  });
  writeFileSync(
    `${root}smoke-${name}.png`,
    Buffer.from(r.result.data, "base64"),
  );
};

await cdp("Runtime.enable");
await cdp("Network.enable");
await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 960,
  deviceScaleFactor: 1,
  mobile: false,
});
await cdp("Page.navigate", { url: `http://127.0.0.1:${HTTP_PORT}/` });
await waitFor(
  () => evaluate(`document.querySelectorAll('#greeks tr').length===5`),
  "ready",
);
check(
  "five Greeks bothrights explicitunits",
  await evaluate(
    `document.querySelectorAll('#greeks td').length===20&&document.querySelector('#greeks').textContent.includes('calendar day elapsed')`,
  ),
);
check(
  "default prices finite andpositive",
  await evaluate(
    `Number(document.querySelector('#call-price').textContent)>4&&Number(document.querySelector('#put-price').textContent)>3`,
  ),
);
check(
  "parity disclosed as not independentvalidation",
  await evaluate(
    `document.querySelector('.parity').textContent.includes('not independent validation')`,
  ),
);
await shot("default");
const edit = async (id, value) =>
    evaluate(
      `document.querySelector('#${id}').value=${JSON.stringify(value)};document.querySelector('#${id}').dispatchEvent(new Event('input'));true`,
    ),
  submit = async () =>
    evaluate(`document.querySelector('#inputs').requestSubmit();true`);
const old = await evaluate(`document.querySelector('#call-price').textContent`);
await edit("spot", "120");
check(
  "dirtyinputdoesnotchangeappliedresult",
  await evaluate(
    `document.querySelector('#status').textContent.startsWith('Unapplied')&&document.querySelector('#call-price').textContent===${JSON.stringify(old)}`,
  ),
);
await submit();
check(
  "submitrepricesallresults",
  await evaluate(
    `Number(document.querySelector('#call-price').textContent)>20&&document.querySelector('#status').textContent.startsWith('Updated')`,
  ),
);
const good = await evaluate(
  `document.querySelector('#call-price').textContent`,
);
for (const [id, v] of [
  ["spot", ""],
  ["spot", "1001"],
  ["days", "0"],
  ["volatility", "0"],
  ["rate", "21"],
  ["yield", "-1"],
]) {
  await edit(id, v);
  await submit();
  check(
    `invalid${id}${v}preservesresults`,
    await evaluate(
      `document.querySelector('#status').textContent.startsWith('Not applied')&&document.querySelector('#call-price').textContent===${JSON.stringify(good)}`,
    ),
  );
  await evaluate(`document.querySelector('#reset').click();true`);
  await edit("spot", "120");
  await submit();
}
await evaluate(`document.querySelector('#reset').click();true`);
await edit("volatility", "150");
await submit();
check(
  "uppervolshockexplicitlynotextrapolated",
  await evaluate(
    `document.querySelector('#shock-note').textContent.includes('exceed')&&document.querySelector('#shock-rows').textContent.includes('Not evaluated')`,
  ),
);
await evaluate(
  `document.querySelector('#reset').click();document.querySelector('#side').value='put';document.querySelector('#side').dispatchEvent(new Event('change'));document.querySelector('#cursor').value='0';document.querySelector('#cursor').dispatchEvent(new Event('input'));true`,
);
check(
  "putpayoffatlowerboundary",
  await evaluate(
    `document.querySelector('#sweep-payoff').textContent==='50.0000'&&Number(document.querySelector('#sweep-delta').textContent)<0`,
  ),
);
await evaluate(`document.querySelector('#reset').click();true`);
for (const width of [320, 360, 390, 768]) {
  await cdp("Emulation.setDeviceMetricsOverride", {
    width,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await new Promise((r) => setTimeout(r, 200));
  check(
    `${width}px nooverflow`,
    await evaluate(`document.documentElement.scrollWidth<=innerWidth`),
  );
  check(
    `${width}px livechartwidth`,
    await evaluate(
      `document.querySelector('#chart').viewBox.baseVal.width<innerWidth`,
    ),
  );
  await shot(`mobile-${width}`);
}
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 960,
  deviceScaleFactor: 1,
  mobile: false,
});
await new Promise((r) => setTimeout(r, 200));
await evaluate(`document.querySelector('details').open=true;true`);
await shot("details");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 320,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
for (const [id, v] of [
  ["spot", "1"],
  ["strike", "1000"],
  ["rate", "-5"],
  ["days", "730"],
  ["yield", "15"],
  ["volatility", "150"],
])
  await edit(id, v);
await submit();
check(
  "extreme prices fit quote cells",
  await evaluate(
    `(()=>{for(const s of document.querySelectorAll('.quote-pair strong')){const range=document.createRange();range.selectNodeContents(s);if(range.getBoundingClientRect().width>s.clientWidth+1)return false;}return document.documentElement.scrollWidth<=innerWidth;})()`,
  ),
);
await shot("extreme-320");
await evaluate(`document.querySelector('#reset').click();true`);
check(
  "CSPnonetwork",
  await evaluate(
    `document.querySelector('meta[http-equiv="Content-Security-Policy"]').content.includes("connect-src 'none'")`,
  ),
);
check(
  "nostorage",
  await evaluate(`localStorage.length===0&&sessionStorage.length===0`),
);
check("noexceptions", consoleErrors.length === 0, consoleErrors.join(";"));
const unexpected = requests.filter(
  (u) => !u.startsWith(`http://127.0.0.1:${HTTP_PORT}/`) && u !== "about:blank",
);
check("noofforiginrequests", unexpected.length === 0, unexpected.join(";"));
writeFileSync(
  `${root}build/browser-result.json`,
  JSON.stringify(checks, null, 2),
);
const failed = checks.filter((c) => !c.ok);
console.log(`${checks.length} browser checks, ${failed.length} failed`);
clearTimeout(timeout);
ws.close();
await cleanup(failed.length ? 1 : 0);
