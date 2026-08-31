import { CATEGORIES, type Analysis, type Category } from './analysis';

type PdfText = { x: number; y: number; size: number; text: string; bold?: boolean; color?: [number, number, number] };
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

export function ishikawaPdf(analysis: Analysis, options: { watermark?: boolean; createdAt?: Date } = {}) {
  const categoryCauses = (category: Category) => analysis.causes.filter(c=>c.category===category).slice(0,3);
  let content='q 0.96 0.97 0.98 rg 0 0 842 595 re f Q\n';
  if(options.watermark!==false)content+='q 0.90 0.93 0.95 rg BT /F2 88 Tf 0.848 0.53 -0.53 0.848 222 128 Tm (QONSUL) Tj ET Q\n';
  content+='0.004 0.145 0.259 rg 0 540 842 55 re f\n';
  content+=textLines([
    {x:36,y:565,size:18,text:'QONSUL',bold:true,color:[1,1,1]},
    {x:36,y:550,size:7,text:'DATA · QUALITY · RISK',color:[0.73,0.82,0.88]},
    {x:598,y:565,size:13,text:'ISHIKAWA QUALITY DIAGNOSTIC',bold:true,color:[1,1,1]},
    {x:706,y:550,size:7,text:(options.createdAt||new Date()).toLocaleDateString('de-DE'),color:[0.73,0.82,0.88]},
  ]);
  content+='0.32 0.48 0.60 RG 2 w 74 290 m 724 290 l S 0.32 0.48 0.60 rg 724 290 m 708 299 l 708 281 l h f\n';
  content+='0.004 0.145 0.259 rg 714 235 105 110 re f\n';
  const problem=wrap(analysis.problem,22,6);
  content+=textCommand({x:728,y:325,size:6,text:'AUSGANGSPROBLEM',bold:true,color:[0.73,0.82,0.88]});
  content+=problem.map((line,index)=>textCommand({x:728,y:309-index*13,size:8,text:line,bold:index===0,color:[1,1,1]})).join('');
  const top=[CATEGORIES[0],CATEGORIES[2],CATEGORIES[4]],bottom=[CATEGORIES[1],CATEGORIES[3],CATEGORIES[5]],anchors=[204,414,624];
  function branch(category:Category,index:number,isTop:boolean){
    const sx=anchors[index],sy=290,ex=sx-62,ey=isTop?490:90;
    content+=`0.32 0.48 0.60 RG 1.5 w ${sx} ${sy} m ${ex} ${ey} l S\n`;
    content+=textCommand({x:ex-82,y:isTop?505:70,size:12,text:category.toUpperCase(),bold:true});
    const causes=categoryCauses(category),slots=causes.length===1?[0.52]:causes.length===2?[0.38,0.70]:[0.25,0.50,0.75];
    causes.forEach((cause,causeIndex)=>{
      const t=slots[causeIndex],px=sx+(ex-sx)*t,py=sy+(ey-sy)*t,left=px-108;
      content+=`0.45 0.56 0.65 RG .7 w ${left} ${py} m ${px} ${py} l S\n`;
      const wrapped=wrap(cause.text,31,2),baseY=isTop?py+17:py-10;
      wrapped.forEach((line,lineIndex)=>{content+=textCommand({x:left,y:baseY-lineIndex*8,size:6.5,text:line,bold:cause.source==='user'});});
      const sourceY=isTop?py-10:baseY-wrapped.length*8-1;
      content+=textCommand({x:left,y:sourceY,size:5.2,text:cause.source==='user'?'EIGENE BEOBACHTUNG':cause.source==='ai'?'KI-HYPOTHESE':'REGEL-HYPOTHESE',color:[0.32,0.48,0.60]});
    });
  }
  top.forEach((category,index)=>branch(category,index,true));bottom.forEach((category,index)=>branch(category,index,false));
  content+='0.32 0.48 0.60 RG .6 w 36 31 m 806 31 l S\n';
  content+=textLines([
    {x:36,y:17,size:7,text:'QONSUL Managementberatung UG (haftungsbeschränkt)',bold:true},
    {x:645,y:17,size:7,text:'www.qonsul.de',bold:true,color:[0.32,0.48,0.60]},
    {x:36,y:41,size:6,text:`${analysis.causes.length} Beobachtungen und Hypothesen · Hypothesen sind anhand geeigneter Daten und Versuche zu prüfen.`,color:[0.32,0.48,0.60]},
  ]);
  const stream=bytes(content);
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${content}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  const chunks:Uint8Array[]=[bytes('%PDF-1.4\n%âãÏÓ\n')],offsets=[0];let offset=chunks[0].length;
  objects.forEach((object,index)=>{offsets.push(offset);const chunk=bytes(`${index+1} 0 obj\n${object}\nendobj\n`);chunks.push(chunk);offset+=chunk.length;});
  const xrefOffset=offset;let xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objects.length;i++)xref+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  chunks.push(bytes(xref+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  const total=chunks.reduce((sum,chunk)=>sum+chunk.length,0),pdf=new Uint8Array(total);let position=0;
  chunks.forEach(chunk=>{pdf.set(chunk,position);position+=chunk.length;});return pdf;
}

export function downloadIshikawaPdf(analysis:Analysis, watermark=true){
  const url=URL.createObjectURL(new Blob([ishikawaPdf(analysis,{watermark})],{type:'application/pdf'}));
  const link=document.createElement('a');link.href=url;link.download='QONSUL-Ishikawa-A4-Querformat.pdf';link.hidden=true;
  document.body.appendChild(link);link.click();setTimeout(()=>{link.remove();URL.revokeObjectURL(url);},1000);
}
