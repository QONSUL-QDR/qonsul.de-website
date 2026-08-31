import { CATEGORIES, type Analysis, type Category } from './analysis';

type PdfText = { x: number; y: number; size: number; text: string; bold?: boolean; color?: [number, number, number] };
type PdfOptions = { watermark?: boolean; createdAt?: Date; logoJpeg?: Uint8Array; logoWidth?: number; logoHeight?: number };
const NAVY:[number,number,number]=[0.004,0.145,0.259],STEEL:[number,number,number]=[0.322,0.482,0.6],SILVER:[number,number,number]=[0.443,0.514,0.576],PAPER:[number,number,number]=[0.957,0.965,0.969];
const winAnsi: Record<string, number> = { '€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159 };
function bytes(value: string) { return Uint8Array.from([...value].map(char => char.charCodeAt(0) <= 255 ? char.charCodeAt(0) : winAnsi[char] ?? 63)); }
function literal(value: string) { return value.replace(/[\\()]/g, '\\$&').replace(/[\r\n]+/g, ' '); }
function wrap(value: string, limit: number, lines = 2) {
  const words=value.trim().split(/\s+/);const result:string[]=[];let current='';
  for(const word of words){const next=current?current+' '+word:word;if(next.length<=limit){current=next;continue;}if(current)result.push(current);current=word;if(result.length===lines-1)break;}
  if(current&&result.length<lines)result.push(current);
  if(result.join(' ').length<value.trim().length&&result.length)result[result.length-1]=result[result.length-1].replace(/[.,;:]?$/,'')+'…';
  return result;
}
function textCommand(item: PdfText) {
  const [r,g,b]=item.color||[0.004,0.145,0.259];
  return `${r} ${g} ${b} rg BT /${item.bold?'F2':'F1'} ${item.size} Tf 1 0 0 1 ${item.x} ${item.y} Tm (${literal(item.text)}) Tj ET\n`;
}
const textLines = (items: PdfText[]) => items.map(textCommand).join('');
function concat(chunks:Uint8Array[]){const total=chunks.reduce((sum,chunk)=>sum+chunk.length,0),joined=new Uint8Array(total);let at=0;for(const chunk of chunks){joined.set(chunk,at);at+=chunk.length;}return joined;}

export function ishikawaPdf(analysis: Analysis, options: PdfOptions = {}) {
  const categoryCauses = (category: Category) => analysis.causes.filter(c=>c.category===category).slice(0,3);
  let content=`q ${PAPER.join(' ')} rg 0 0 842 595 re f Q\n`;
  if(options.watermark!==false){for(const [x,y] of [[40,120],[295,120],[550,120],[40,355],[295,355],[550,355]])content+=`q 0.91 0.93 0.95 rg BT /F2 36 Tf 0.866 0.5 -0.5 0.866 ${x} ${y} Tm (QONSUL) Tj ET Q\n`;}
  content+=`q ${PAPER.join(' ')} rg 0 540 842 55 re f Q\n`;
  if(options.logoJpeg)content+='q 180 0 0 43.8 28 548 cm /Logo Do Q\n';
  content+=textLines([
    ...(!options.logoJpeg?[{x:32,y:567,size:18,text:'QONSUL',bold:true,color:NAVY} as PdfText,{x:32,y:551,size:7,text:'MANAGEMENTBERATUNG',color:STEEL} as PdfText]:[]),
    {x:598,y:570,size:12,text:'ISHIKAWA QUALITY DIAGNOSTIC',bold:true,color:NAVY},
    {x:752,y:553,size:7,text:(options.createdAt||new Date()).toLocaleDateString('de-DE'),color:SILVER},
  ]);
  content+=`0.004 0.145 0.259 rg 0 540 360 4 re f 0.322 0.482 0.6 rg 360 540 180 4 re f 0.443 0.514 0.576 rg 540 540 150 4 re f 0.663 0.745 0.808 rg 690 540 152 4 re f\n`;
  content+='0.004 0.145 0.259 rg 744 232 86 112 re f\n';
  const problem=wrap(analysis.problem,18,6);
  content+=textCommand({x:754,y:322,size:6,text:'AUSGANGSPROBLEM',bold:true,color:[0.73,0.82,0.88]});
  content+=problem.map((line,index)=>textCommand({x:754,y:305-index*13,size:8,text:line,bold:index===0,color:[1,1,1]})).join('');
  content+='0.322 0.482 0.6 RG 2 w 60 288 m 731 288 l S 0.322 0.482 0.6 rg 731 297 m 744 288 l 731 279 l h f\n';
  const top=[CATEGORIES[0],CATEGORIES[2],CATEGORIES[4]],bottom=[CATEGORIES[1],CATEGORIES[3],CATEGORIES[5]],anchors=[190,404,618];
  function branch(category:Category,index:number,isTop:boolean){
    const sx=anchors[index],sy=288,ex=sx-62,ey=isTop?488:88;
    content+=`0.32 0.48 0.60 RG 1.5 w ${sx} ${sy} m ${ex} ${ey} l S\n`;
    content+=textCommand({x:ex-82,y:isTop?505:70,size:12,text:category.toUpperCase(),bold:true});
    const causes=categoryCauses(category),slots=causes.length===1?[0.52]:causes.length===2?[0.38,0.70]:[0.25,0.50,0.75];
    causes.forEach((cause,causeIndex)=>{
      const t=slots[causeIndex],px=sx+(ex-sx)*t,py=sy+(ey-sy)*t,left=px-105;
      content+=`0.443 0.514 0.576 RG .7 w ${left} ${py} m ${px} ${py} l S\n`;
      const wrapped=wrap(cause.text,30,2),baseY=isTop?py+14:py-13;
      wrapped.forEach((line,lineIndex)=>{content+=textCommand({x:left,y:baseY-lineIndex*8,size:6.5,text:line,bold:cause.source==='user'});});
      const sourceY=isTop?py-9:baseY-wrapped.length*8-1;
      content+=textCommand({x:left,y:sourceY,size:5.2,text:cause.source==='user'?'EIGENE BEOBACHTUNG':cause.source==='ai'?'KI-HYPOTHESE':'REGEL-HYPOTHESE',color:STEEL});
    });
  }
  top.forEach((category,index)=>branch(category,index,true));bottom.forEach((category,index)=>branch(category,index,false));
  content+='0.004 0.145 0.259 rg 36 30 420 2 re f 0.322 0.482 0.6 rg 456 30 180 2 re f 0.443 0.514 0.576 rg 636 30 170 2 re f\n';
  content+=textLines([
    {x:36,y:17,size:7,text:'QONSUL Managementberatung UG (haftungsbeschränkt)',bold:true},
    {x:700,y:17,size:7,text:'www.qonsul.de',bold:true,color:STEEL},
    {x:36,y:41,size:6,text:`${analysis.causes.length} Beobachtungen und Hypothesen · Hypothesen sind anhand geeigneter Daten und Versuche zu prüfen.`,color:STEEL},
  ]);
  const stream=bytes(content);
  const resources=`<< /Font << /F1 5 0 R /F2 6 0 R >>${options.logoJpeg?' /XObject << /Logo 7 0 R >>':''} >>`;
  const objects:(string|Uint8Array)[]=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources ${resources} /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${content}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  if(options.logoJpeg)objects.push(concat([bytes(`<< /Type /XObject /Subtype /Image /Width ${options.logoWidth||900} /Height ${options.logoHeight||219} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${options.logoJpeg.length} >>\nstream\n`),options.logoJpeg,bytes('\nendstream')]));
  const chunks:Uint8Array[]=[bytes('%PDF-1.4\n%âãÏÓ\n')],offsets=[0];let offset=chunks[0].length;
  objects.forEach((object,index)=>{offsets.push(offset);const body=typeof object==='string'?bytes(object):object,chunk=concat([bytes(`${index+1} 0 obj\n`),body,bytes('\nendobj\n')]);chunks.push(chunk);offset+=chunk.length;});
  const xrefOffset=offset;let xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objects.length;i++)xref+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  chunks.push(bytes(xref+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return concat(chunks);
}

let logoRequest:Promise<Uint8Array|undefined>|undefined;
function printLogo(){return logoRequest??=fetch('/qonsul-logo-print.jpg').then(async response=>response.ok?new Uint8Array(await response.arrayBuffer()):undefined).catch(()=>undefined);}
export async function downloadIshikawaPdf(analysis:Analysis, watermark=true){
  const logoJpeg=await printLogo();
  const url=URL.createObjectURL(new Blob([ishikawaPdf(analysis,{watermark,logoJpeg,logoWidth:900,logoHeight:219})],{type:'application/pdf'}));
  const link=document.createElement('a');link.href=url;link.download='QONSUL-Ishikawa-A4-Querformat.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
