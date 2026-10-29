import Brand from '@/app/brand';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import privacyMarkdown from '../../docs/legal/QONSUL_Datenschutzhinweise_Veroeffentlichungsfassung_2026-10-04.md?raw';

export const metadata = { title: 'Datenschutzhinweise · QONSUL' };

const [preface, ...rawSections] = privacyMarkdown.trim().replace(/\r\n/g, '\n').split(/^## /m);
const title = preface.match(/^# (.+)$/m)?.[1];
const version = preface.match(/^Stand: .+$/m)?.[0];

if (!title || !version || rawSections.length !== 10) {
  throw new Error('Die verbindliche Fassung der Datenschutzhinweise ist unvollständig.');
}

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|info@qonsul\.de)/g).map((part, index) => {
    if (part === 'info@qonsul.de') return <a key={index} href="mailto:info@qonsul.de">{part}</a>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function block(content: string, index: number): ReactNode {
  if (content.startsWith('- ')) {
    return <ul key={index}>{content.split('\n').map((item, itemIndex) => <li key={itemIndex}>{inline(item.slice(2))}</li>)}</ul>;
  }

  return <p key={index}>{content.split(/(?: {2}|\\)\n/).map((line, lineIndex) => <Fragment key={lineIndex}>{lineIndex > 0 && <br />}{inline(line.trim())}</Fragment>)}</p>;
}

export default function Datenschutz(): ReactNode {
  return <>
    <header className="header"><Link className="brand" href="/"><Brand /></Link><Link href="/" className="button button-outline">← Zur Startseite</Link></header>
    <main className="legal-page">
      <div className="eyebrow">TRANSPARENZ & DATENSCHUTZ</div>
      <h1>{title}</h1>
      <p>{version}</p>
      {rawSections.map((section, sectionIndex) => {
        const [heading, ...body] = section.trim().split('\n');
        return <section key={sectionIndex}><h2>{heading}</h2>{body.join('\n').trim().split(/\n\s*\n/).map(block)}</section>;
      })}
    </main>
  </>;
}
