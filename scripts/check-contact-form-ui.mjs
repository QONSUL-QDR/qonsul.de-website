import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'FormData']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = () => 0;
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };

const requests = [];
globalThis.fetch = async (url, options) => {
  if (url === '/api/status') return Response.json({ productionReady: false, contactReady: false, contactEmail: 'info@qonsul.de' });
  if (url === '/api/contact') {
    requests.push(JSON.parse(options.body));
    return Response.json({ stored: true, crmStatus: 'not_configured', emailStatus: 'not_configured' }, { status: 201 });
  }
  throw new Error(`Unexpected request: ${url}`);
};

const vite = await createServer({ configFile: false, root, appType: 'custom', server: { middlewareMode: true }, resolve: { alias: { '@': root } } });
const reactRoot = createRoot(document.getElementById('root'));
try {
  const { default: ContactDialog } = await vite.ssrLoadModule('/app/contact-dialog.tsx');
  await act(async () => { reactRoot.render(createElement(ContactDialog, { open: true, onClose: () => {} })); });
  const dialog = document.querySelector('dialog');
  assert.ok(dialog.open);
  assert.equal(dialog.querySelector('input[name="demo"]'), null, 'the test-data checkbox is absent');
  assert.doesNotMatch(dialog.textContent, /Ich bestätige, ausschließlich fiktive Testdaten zu verwenden/);
  const company = dialog.querySelector('input[name="company"]');
  assert.equal(company.required, true, 'company is required in the browser');
  assert.equal(company.checkValidity(), false, 'the browser blocks an empty company');

  for (const [name, value] of [['name', 'Fiktive Person'], ['email', 'fiktiv@example.invalid'], ['company', 'Fiktives Unternehmen'], ['message', 'Synthetische Anfrage für einen lokalen UI-Test.']]) {
    dialog.querySelector(`[name="${name}"]`).value = value;
  }
  dialog.querySelector('input[name="privacy"]').checked = true;
  const form = dialog.querySelector('form');
  assert.equal(form.checkValidity(), true, 'the form is valid without a test-data checkbox');
  await act(async () => { form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  assert.equal(requests.length, 1, 'one valid contact request is submitted');
  assert.equal(requests[0].company, 'Fiktives Unternehmen');
  assert.equal(Object.hasOwn(requests[0], 'demoConfirmed'), false, 'the payload has no demo confirmation');
  assert.match(dialog.textContent, /Ihre Anfrage ist gespeichert/);
  console.log('PASS contact UI has no test-data checkbox, requires company, and submits once without demoConfirmed');
} finally {
  await act(async () => { reactRoot.unmount(); });
  await vite.close();
  dom.window.close();
}
