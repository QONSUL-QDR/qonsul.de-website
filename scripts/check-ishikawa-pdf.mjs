import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const root=process.cwd(),tmp=path.join(root,'tmp','pdfs');
await mkdir(tmp,{recursive:true});
const compile=async(source,target)=>{
  const input=await readFile(source,'utf8');
  const output=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText.replace("'./analysis'","'./analysis.mjs'");
  await writeFile(target,output);
};
await compile(path.join(root,'lib','analysis.ts'),path.join(tmp,'analysis.mjs'));
const bundled=path.join(tmp,'ishikawa-pdf-check.mjs');
await compile(path.join(root,'lib','ishikawa-pdf.ts'),bundled);
const {downloadIshikawaPdf,ishikawaPdf}=await import(pathToFileURL(bundled).href+'?v='+Date.now());

const analysis={
  problem:'Ausfall (sporadisch) bei 80 °C \\ Referenz',
  mode:'manual',
  causes:[{id:'cause-1',category:'Produkt',text:'Toleranz außerhalb der Freigabe',source:'user'}],
};
const createdAt=new Date('2026-01-02T12:00:00Z');
const pdf=ishikawaPdf(analysis,{watermark:false,createdAt});
const source=Buffer.from(pdf).toString('latin1');
assert.ok(source.startsWith('%PDF-1.4\n'),'PDF header is present');
assert.ok(source.endsWith('%%EOF'),'PDF trailer is present');
assert.match(source,/\/MediaBox \[0 0 842 595\]/,'A4 landscape page box is present');
assert.match(source,/2\.1\.2026/,'Configured creation date is rendered');
assert.ok(source.includes('(Ausfall \\(sporadisch\\))'),'Parentheses in user text are escaped');
assert.ok(source.includes('(bei 80 °C \\\\ Referenz)'),'Backslashes in user text are escaped');
assert.doesNotMatch(source,/\/F2 88 Tf/,'Watermark can be disabled');
assert.match(Buffer.from(ishikawaPdf(analysis,{watermark:true,createdAt})).toString('latin1'),/\/F2 88 Tf/,'Watermark can be enabled');
const xrefOffset=Number(source.match(/startxref\n(\d+)\n%%EOF$/)?.[1]);
assert.equal(source.slice(xrefOffset,xrefOffset+4),'xref','Cross-reference offset points to the xref table');

let appended=false,clicked=false,removed=false,revoked='',createdBlob,timeoutDelay,cleanup;
const link={href:'',download:'',hidden:false,click(){clicked=true;},remove(){removed=true;}};
const previousDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
const originalCreateObjectURL=URL.createObjectURL,originalRevokeObjectURL=URL.revokeObjectURL,originalSetTimeout=globalThis.setTimeout;
Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(tag){assert.equal(tag,'a');return link;},body:{appendChild(node){assert.equal(node,link);appended=true;return node;}}}});
URL.createObjectURL=blob=>{createdBlob=blob;return 'blob:qonsul-pdf-test';};
URL.revokeObjectURL=url=>{revoked=url;};
globalThis.setTimeout=(callback,delay)=>{timeoutDelay=delay;cleanup=callback;return 0;};
try{
  const result=downloadIshikawaPdf(analysis,false);
  assert.equal(result,undefined,'Download is initiated synchronously inside the user action');
  assert.ok(appended&&clicked,'Temporary download link is attached and activated synchronously');
  assert.equal(removed,false,'Download link remains attached while the browser starts the download');
  assert.equal(link.download,'QONSUL-Ishikawa-A4-Querformat.pdf','Download has the expected filename');
  assert.equal(link.hidden,true,'Temporary download link stays hidden');
  assert.equal(createdBlob?.type,'application/pdf','Download blob has the PDF MIME type');
  assert.ok(createdBlob?.size>1000,'Download blob contains a complete PDF');
  assert.equal(timeoutDelay,1000,'Object URL cleanup is deferred until after download start');
  cleanup();
  assert.equal(removed,true,'Temporary download link is removed after download start');
  assert.equal(revoked,'blob:qonsul-pdf-test','Object URL is released');
}finally{
  URL.createObjectURL=originalCreateObjectURL;URL.revokeObjectURL=originalRevokeObjectURL;globalThis.setTimeout=originalSetTimeout;
  if(previousDocument)Object.defineProperty(globalThis,'document',previousDocument);else delete globalThis.document;
}

console.log('PASS Ishikawa PDF structure and synchronous browser download');
