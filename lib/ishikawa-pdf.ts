import { CATEGORIES, type Analysis, type Category } from './analysis';
import { QONSUL_PDF_LOGO_BASE64, QONSUL_PDF_LOGO_HEIGHT, QONSUL_PDF_LOGO_WIDTH } from './qonsul-logo-pdf';

type PdfText = { x: number; y: number; size: number; text: string; bold?: boolean; color?: [number, number, number] };
const winAnsi: Record<string, number> = { '€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159 };
function bytes(value: string) { return Uint8Array.from([...value].map(char => char.charCodeAt(0) <= 255 ? char.charCodeAt(0) : winAnsi[char] ?? 63)); }
function literal(value: string) { return value.replace(/[\\()]/g, '\\$&').replace(/[\r\n]+/g, ' '); }
// Standard Helvetica advance widths in WinAnsi order (32–255), in 1/1000 em.
// Measure the printed font so wide letters and unbroken part numbers stay inside their branch.
const fontWidths = [
  [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,761,222,556,333,1000,556,556,333,1000,667,333,1000,761,611,761,761,222,222,333,333,350,556,1000,333,1000,500,333,944,761,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
  [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,761,278,556,500,1000,556,556,333,1000,667,333,1000,761,611,761,761,278,278,500,500,350,556,1000,333,1000,556,333,944,761,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556],
];
function textWidth(value: string, size: number, bold = false) {
  return [...bytes(value)].reduce((total, code) => total + (fontWidths[bold ? 1 : 0][code - 32] ?? 556), 0) * size / 1000;
}
function wrap(value: string, width: number, size: number, lines: number, bold = false) {
  let remaining=value.trim().replace(/\s+/g, ' ');
  const result:string[]=[];
  while(remaining && result.length<lines){
    const chars=[...remaining];let count=0;
    while(count<chars.length && textWidth(chars.slice(0,count+1).join(''),size,bold)<=width)count++;
    let end=Math.max(1,count);
    if(end<chars.length && chars[end]!==' '){
      const space=chars.slice(0,end).lastIndexOf(' ');
      if(space>0)end=space;
    }
    let line=chars.slice(0,end).join('').trimEnd();
    remaining=chars.slice(end).join('').trimStart();
    if(remaining && result.length===lines-1){
      while(line && textWidth(line+'…',size,bold)>width)line=line.slice(0,-1).trimEnd();
      line+='…';
    }
    result.push(line);
  }
  return result;
}
function textCommand(item: PdfText) {
  const [r,g,b]=item.color||[0.004,0.145,0.259];
  return `${r} ${g} ${b} rg BT /${item.bold?'F2':'F1'} ${item.size} Tf 1 0 0 1 ${item.x} ${item.y} Tm (${literal(item.text)}) Tj ET\n`;
}
const textLines = (items: PdfText[]) => items.map(textCommand).join('');
function concat(chunks:Uint8Array[]){const total=chunks.reduce((sum,chunk)=>sum+chunk.length,0),joined=new Uint8Array(total);let at=0;for(const chunk of chunks){joined.set(chunk,at);at+=chunk.length;}return joined;}
let logoJpeg:Uint8Array|undefined;
function pdfLogo(){if(logoJpeg)return logoJpeg;const binary=atob(QONSUL_PDF_LOGO_BASE64);logoJpeg=Uint8Array.from(binary,char=>char.charCodeAt(0));return logoJpeg;}

export function ishikawaPdf(analysis: Analysis, options: { watermark?: boolean; createdAt?: Date } = {}) {
  const categoryCauses = (category: Category) => analysis.causes.filter(c=>c.category===category);
  const logo=pdfLogo(),logoWidth=150,logoHeight=logoWidth*QONSUL_PDF_LOGO_HEIGHT/QONSUL_PDF_LOGO_WIDTH;
  let content='q 0.957 0.965 0.969 rg 0 0 842 595 re f Q\n';
  if(options.watermark!==false){
    for(const [x,y] of [[40,120],[295,120],[550,120],[40,355],[295,355],[550,355]]){
      content+=`q 0.90 0.925 0.945 rg BT /F2 36 Tf 0.866 0.5 -0.5 0.866 ${x} ${y} Tm (QONSUL) Tj ET Q\n`;
    }
  }
  content+='q 1 1 1 rg 0 528 842 67 re f Q\n';
  content+=`q ${logoWidth} 0 0 ${logoHeight.toFixed(2)} 24 533 cm /Logo Do Q\n`;
  content+=textLines([
    {x:598,y:560,size:13,text:'ISHIKAWA QUALITY DIAGNOSTIC',bold:true},
    {x:706,y:543,size:7,text:(options.createdAt||new Date()).toLocaleDateString('de-DE'),color:[0.32,0.48,0.60]},
  ]);
  content+='0.004 0.145 0.259 rg 0 528 360 3 re f 0.322 0.482 0.6 rg 360 528 180 3 re f 0.443 0.514 0.576 rg 540 528 150 3 re f 0.663 0.745 0.808 rg 690 528 152 3 re f\n';
  // Keep the entire arrowhead outside the problem box, with a visible four-point gap.
  content+='0.004 0.145 0.259 rg 724 232 100 112 re f\n';
  content+='0.322 0.482 0.60 RG 2 w 60 288 m 706 288 l S 0.322 0.482 0.60 rg 706 297 m 720 288 l 706 279 l h f\n';
  const problem=wrap(analysis.problem,80,7.5,7,true);
  content+=textCommand({x:734,y:327,size:5.5,text:'AUSGANGSPROBLEM',bold:true,color:[0.73,0.82,0.88]});
  content+=problem.map((line,index)=>textCommand({x:734,y:312-index*11,size:7.5,text:line,bold:index===0,color:[1,1,1]})).join('');
  const top=[CATEGORIES[0],CATEGORIES[2],CATEGORIES[4]],bottom=[CATEGORIES[1],CATEGORIES[3],CATEGORIES[5]],anchors=[190,404,618];
  function branch(category:Category,index:number,isTop:boolean){
    const sx=anchors[index],sy=288,ex=sx-62,ey=isTop?488:88;
    content+=`0.322 0.482 0.60 RG 1.5 w ${sx} ${sy} m ${ex} ${ey} l S\n`;
    content+=textCommand({x:ex-82,y:isTop?505:70,size:12,text:category.toUpperCase(),bold:true});
    const causes=categoryCauses(category);
    causes.forEach((cause,causeIndex)=>{
      const t=causes.length===5?0.14+causeIndex*0.18:(causeIndex+1)/(causes.length+1),px=sx+(ex-sx)*t,py=sy+(ey-sy)*t,left=px-105;
      content+=`0.443 0.514 0.576 RG .7 w ${left} ${py} m ${px} ${py} l S\n`;
      const wrapped=wrap(cause.text,90,6.5,causes.length>3?2:3,cause.source==='user');
      // Text sits above upper branches and below lower branches; source labels have their own space.
      const baseY=isTop?py+9+(wrapped.length-1)*8.5:py-11;
      wrapped.forEach((line,lineIndex)=>{content+=textCommand({x:left,y:baseY-lineIndex*8.5,size:6.5,text:line,bold:cause.source==='user'});});
      const sourceY=isTop?py-10:baseY-(wrapped.length-1)*8.5-10;
      content+=textCommand({x:left,y:sourceY,size:5.2,text:cause.source==='user'?'EIGENE BEOBACHTUNG':cause.source==='ai'?'KI-HYPOTHESE':'REGEL-HYPOTHESE',color:[0.32,0.48,0.60]});
    });
  }
  top.forEach((category,index)=>branch(category,index,true));bottom.forEach((category,index)=>branch(category,index,false));
  content+='0.32 0.48 0.60 RG .6 w 36 31 m 806 31 l S\n';
  content+=textLines([
    {x:36,y:17,size:7,text:'QONSUL Managementberatung UG (haftungsbeschränkt)',bold:true},
    {x:645,y:17,size:7,text:'www.qonsul.de',bold:true,color:[0.32,0.48,0.60]},
    {x:36,y:41,size:6,text:`${analysis.causes.length} Beobachtungen und Hypothesen · Texte ggf. gekürzt (…). Hypothesen mit Daten und Versuchen prüfen.`,color:[0.32,0.48,0.60]},
  ]);
  const stream=bytes(content);
  const resources='<< /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Logo 7 0 R >> >>';
  const objects:(string|Uint8Array)[]=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources ${resources} /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${content}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    concat([bytes(`<< /Type /XObject /Subtype /Image /Width ${QONSUL_PDF_LOGO_WIDTH} /Height ${QONSUL_PDF_LOGO_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.length} >>\nstream\n`),logo,bytes('\nendstream')]),
  ];
  const chunks:Uint8Array[]=[bytes('%PDF-1.4\n%âãÏÓ\n')],offsets=[0];let offset=chunks[0].length;
  objects.forEach((object,index)=>{offsets.push(offset);const body=typeof object==='string'?bytes(object):object,chunk=concat([bytes(`${index+1} 0 obj\n`),body,bytes('\nendobj\n')]);chunks.push(chunk);offset+=chunk.length;});
  const xrefOffset=offset;let xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objects.length;i++)xref+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  chunks.push(bytes(xref+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return concat(chunks);
}

export function downloadIshikawaPdf(analysis:Analysis, watermark=true){
  const url=URL.createObjectURL(new Blob([ishikawaPdf(analysis,{watermark})],{type:'application/pdf'}));
  const link=document.createElement('a');link.href=url;link.download='QONSUL-Ishikawa-A4-Querformat.pdf';link.hidden=true;
  document.body.appendChild(link);link.click();setTimeout(()=>{link.remove();URL.revokeObjectURL(url);},1000);
}
