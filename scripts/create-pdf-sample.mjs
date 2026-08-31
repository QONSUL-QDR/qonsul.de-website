import ts from 'typescript';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const root=process.cwd(),tmp=path.join(root,'tmp','pdfs'),output=path.join(root,'output','pdf');
await mkdir(tmp,{recursive:true});await mkdir(output,{recursive:true});
const compile=async(source,target)=>{const input=await readFile(source,'utf8');const output=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText.replace("'./analysis'","'./analysis.mjs'");await writeFile(target,output);};
await compile(path.join(root,'lib','analysis.ts'),path.join(tmp,'analysis.mjs'));
const bundled=path.join(tmp,'ishikawa-pdf.mjs');
await compile(path.join(root,'lib','ishikawa-pdf.ts'),bundled);
const {ishikawaPdf}=await import(pathToFileURL(bundled).href+'?v='+Date.now());
const logoJpeg=new Uint8Array(await readFile(path.join(root,'public','qonsul-logo-print.jpg')));
const categories=['Produkt','Prozess','Material','Mensch','Messung','Umgebung'];
const examples={
  Produkt:['Toleranzkette berücksichtigt thermische Ausdehnung nicht vollständig','Funktionsreserve im kritischen Lastfall ist zu gering','Schnittstellenanforderung wurde unterschiedlich interpretiert'],
  Prozess:['Prozessfenster driftet während der Aufwärmphase','Änderung wurde ohne erneute Freigabe übernommen','Prüfreihenfolge beeinflusst das beobachtete Fehlerbild'],
  Material:['Eigenschaften schwanken zwischen Lieferchargen','Feuchteaufnahme verändert das Werkstoffverhalten','Wareneingangsprüfung erfasst das kritische Merkmal nicht'],
  Mensch:['Verantwortung für auffällige Messwerte ist unklar','Arbeitsanweisung wird unterschiedlich interpretiert','Reklamationserkenntnisse fließen verzögert zurück'],
  Messung:['Messsystemstreuung überlagert die Produktstreuung','Temperaturdrift des Sensors wird nicht kompensiert','Zeitstempel und Chargenzuordnung sind nicht konsistent'],
  Umgebung:['Prüfprofil bildet reale Einsatzbedingungen nur teilweise ab','Temperatur und Vibration wirken möglicherweise gemeinsam','Transportbedingungen belasten Komponenten vor dem Einsatz'],
};
const analysis={problem:'Sporadische Funktionsausfälle nach thermischer Belastung in der Serienprüfung',mode:'rules',availableData:['Prüf- & Messdaten','Umgebungsdaten'],causes:categories.flatMap(category=>examples[category].map((text,index)=>({id:`sample-${category}-${index}`,category,text,source:index===0?'user':'rules'})))};
const file=path.join(output,'QONSUL-Ishikawa-A4-Querformat-Muster.pdf');
await writeFile(file,ishikawaPdf(analysis,{watermark:true,createdAt:new Date('2026-08-31T12:00:00Z'),logoJpeg,logoWidth:900,logoHeight:219}));
console.log(file);
