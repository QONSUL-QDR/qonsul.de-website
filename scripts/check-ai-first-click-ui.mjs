import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'localStorage']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: name === 'localStorage' ? dom.window.localStorage : dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.Element.prototype.scrollIntoView = () => {};

const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (callback, delay, ...args) => realSetTimeout(callback, [3_000, 2_500, 320].includes(delay) ? 1 : delay, ...args);

const categories = ['Produkt', 'Prozess', 'Material', 'Mensch', 'Messung', 'Umgebung'];
const hypotheses = Array.from({ length: 12 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  category: categories[Math.floor(index / 2)], text: `Prüfbare Hypothese ${index + 1}`,
  source: 'ai', check: `Prüfschritt ${index + 1}`,
}));
let resolveReadiness;
let starts = 0;
let statusReads = 0;
let sourceEventId;
const statuses = ['processing', 'processing', 'completed'];
globalThis.fetch = async (url, options) => {
  if (url === '/api/status') return new Promise(resolve => { resolveReadiness = resolve; });
  if (url === '/api/diagnostic-ai-hypotheses') {
    starts++;
    const body = JSON.parse(options.body);
    assert.equal(body.analysisRound, 1);
    assert.match(body.sourceEventId, /^[0-9a-f-]{36}$/i);
    sourceEventId = body.sourceEventId;
    return Response.json({ status: 'processing' }, { status: 202 });
  }
  if (url === '/api/diagnostic-ai-hypotheses/status') {
    statusReads++;
    assert.equal(JSON.parse(options.body).sourceEventId, sourceEventId, 'every poll uses the first run ID');
    const status = statuses.shift();
    return Response.json(status === 'completed' ? { status, causes: hypotheses } : { status });
  }
  throw new Error(`Unexpected request: ${url}`);
};

const vite = await createServer({ configFile: false, root, appType: 'custom', server: { middlewareMode: true }, resolve: { alias: { '@': root } } });
const reactRoot = createRoot(document.getElementById('root'));
try {
  const { default: QualityDiagnosticLab } = await vite.ssrLoadModule('/app/quality-diagnostic-lab.tsx');
  await act(async () => {
    reactRoot.render(createElement(QualityDiagnosticLab, { launch: { problem: 'Sporadische Ausfälle bei Wärme im synthetischen Test.', id: 1 } }));
  });
  const firstButton = [...document.querySelectorAll('button')].find(button => button.textContent.includes('QONSUL Expertise einbeziehen'));
  assert.ok(firstButton, 'the first-round CTA is visible');
  assert.equal(typeof resolveReadiness, 'function', 'the separate readiness request is still pending');

  await act(async () => { firstButton.click(); firstButton.click(); });
  assert.equal(starts, 1, 'the first click starts exactly one request before readiness resolves');
  assert.equal(firstButton.disabled, true, 'the CTA blocks another click during the run');
  assert.match(firstButton.textContent, /QONSUL Analyse läuft/, 'loading remains visible while polling');
  await act(async () => { firstButton.click(); });
  assert.equal(starts, 1, 'a second click during polling neither starts nor cancels the run');

  for (let attempt = 0; attempt < 100 && document.querySelectorAll('[aria-label="QONSUL-Hypothesen"] li').length !== 12; attempt++) {
    await act(async () => { await new Promise(resolve => realSetTimeout(resolve, 10)); });
  }
  assert.equal(statusReads, 3, 'processing statuses lead to a completed status for the same run');
  assert.equal(document.querySelectorAll('[aria-label="QONSUL-Hypothesen"] li').length, 12, 'all twelve hypotheses render without a second click');
  assert.equal(starts, 1, 'completion never replays the start request');
  assert.match(document.body.textContent, /QONSUL Expertise vertiefen/, 'round one settles into the focused-round CTA');
  resolveReadiness(Response.json({ ai: true, productionReady: false }));
  await act(async () => { await Promise.resolve(); });
  assert.equal(starts, 1, 'late readiness cannot start a duplicate run');
  console.log('PASS delayed readiness, first click, visible polling, double-click guard, and twelve immediate round-one hypotheses');
} finally {
  await act(async () => { reactRoot.unmount(); });
  await vite.close();
  globalThis.setTimeout = realSetTimeout;
  dom.window.close();
}
