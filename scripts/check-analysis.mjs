import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
const asModule=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64');
const analysisUrl=asModule(fs.readFileSync(new URL('../lib/analysis.ts',import.meta.url),'utf8'));
const {CATEGORIES,DATA_KINDS,suggestRules,parseAnalysis,redactForAI}=await import(analysisUrl);
const reportSource=fs.readFileSync(new URL('../lib/report.ts',import.meta.url),'utf8').replace("'./analysis'",JSON.stringify(analysisUrl));
const {reportHtml}=await import(asModule(reportSource));
for(const problem of ['Sporadische thermische Ausfälle','Steigende Ausschussquote in der Produktion','Abweichende Qualität zwischen Lieferchargen']){
 const causes=suggestRules(problem);const parsed=parseAnalysis({problem,causes,availableData:[DATA_KINDS[0]]});
 assert.equal(parsed.causes.length,12);assert.deepEqual([...new Set(parsed.causes.map(c=>c.category))],CATEGORIES);
 assert.ok(causes.every(c=>c.check&&c.data.length&&c.metric));
}
assert.throws(()=>parseAnalysis({problem:'Unbekannte Kategorien ablehnen',causes:[{category:'Codebase',text:'Alte Kategorie',source:'user'}]}));
assert.throws(()=>parseAnalysis({problem:'Neue Hypothesen validieren',causes:[],availableData:['unknown']}));
assert.throws(()=>parseAnalysis({problem:'123456789',causes:[]}),/10 bis 600 Zeichen/,'nine-character problems are rejected locally');
assert.equal(parseAnalysis({problem:'1234567890',causes:[]}).problem,'1234567890','ten-character problems are accepted');
assert.equal(parseAnalysis({problem:'Autoreifen geplatzt',causes:[]}).problem,'Autoreifen geplatzt','short valid customer problems remain accepted');
const legacy={problem:'Archivierte Softwareanalyse',mode:'rules',causes:[{id:'old',category:'Codebase',text:'Historische Beobachtung',source:'user'}]};
assert.ok(reportHtml(legacy).includes('Historische Beobachtung'),'Legacy report causes must not disappear after changing categories');
const unsafe={problem:'<script>alert(1)</script>',mode:'manual',causes:[{id:'one',category:'Produkt',text:'<img src=x onerror=alert(1)>',source:'user'}]};
assert.ok(!reportHtml(unsafe).includes('<script>'));assert.ok(!reportHtml(unsafe).includes('<img'));
assert.ok(!redactForAI('qa@example.com https://example.com sk-test123 192.168.1.1').includes('qa@example'));
console.log('Analysis validation, 3 rule profiles, legacy report and escaping checks passed.');
