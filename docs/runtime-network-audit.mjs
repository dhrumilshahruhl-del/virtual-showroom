// Production network capture. Start Chrome with remote debugging on 9224,
// serve dist/ on 4174, then run: node docs/runtime-network-audit.mjs
const target = new URL(process.env.SHOWROOM_URL || 'http://127.0.0.1:4174/');
const pages = await (await fetch('http://localhost:9224/json')).json();
const page = pages.find(candidate => candidate.type === 'page');
if (!page) throw new Error('No Chrome page is available on port 9224.');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let nextId = 0;
const pending = new Map();
const requests = new Map();
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(message.error);
    else request.resolve(message.result);
  } else if (message.method === 'Network.requestWillBeSent') {
    const url = new URL(message.params.request.url);
    const entry = requests.get(url.origin) || { urls: new Set(), types: new Set() };
    entry.urls.add(url.href);
    entry.types.add(message.params.type || 'unknown');
    requests.set(url.origin, entry);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++nextId, { resolve, reject });
  socket.send(JSON.stringify({ id: nextId, method, params }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Page.navigate', { url: target.href });
  for (let attempt = 0; attempt < 180; attempt++) {
    if (await evaluate('!!document.querySelector(".flow-launch")')) break;
    await wait(500);
  }
  if (!(await evaluate('!!document.querySelector(".flow-launch")'))) throw new Error('Showroom did not finish loading.');
  await evaluate('document.querySelector(".flow-launch").click()');
  await wait(1600);
  await evaluate('document.querySelector("[data-flow=pause]").click()');
  await wait(150);
  await evaluate('document.querySelector("[data-flow=pause]").click()');
  for (let step = 0; step < 6; step++) {
    await evaluate(`document.querySelector('[data-step="${step}"]').click()`);
    await wait(650);
  }
  await evaluate('document.querySelector("[data-flow=previous]").click()');
  await wait(650);
  await evaluate('document.querySelector("[data-flow=next]").click()');
  await wait(650);
  await evaluate('document.querySelector("[data-flow=exit]").click()');
  await wait(1500);
  await evaluate('document.querySelector(".flow-launch").click()');
  await wait(1400);
  const browserState = await evaluate('({ cookies: document.cookie, localStorage: localStorage.length, sessionStorage: sessionStorage.length, impactFlag: document.querySelector(".flow-impact")?.hidden ?? true, equipmentPopups: document.querySelectorAll(".flow-equipment").length, noticesLink: document.querySelector(".showroom__legal-link")?.getAttribute("href") })');
  const origins = [...requests].map(([origin, entry]) => ({ origin, types: [...entry.types], requests: [...entry.urls] }));
  console.log(JSON.stringify({ browserState, requestHosts: origins.map(entry => entry.origin),
    thirdPartyOrigins: origins.filter(entry => entry.origin !== target.origin), origins }, null, 2));
} finally {
  socket.close();
}
