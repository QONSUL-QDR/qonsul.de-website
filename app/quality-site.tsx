'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Existing full-page home navigation is intentional. */
import Brand from '@/app/brand';
import { useState } from 'react';
import IshikawaLab from './ishikawa-lab';
import SiteContent from './site-content';
import HeroSlideshow from './hero-slideshow';
import ContactDialog from './contact-dialog';

export default function QualitySite() {
  const [problem,setProblem]=useState('');
  const [launch,setLaunch]=useState({problem:'',id:0});
  const [menu,setMenu]=useState(false);
  const [contactOpen,setContactOpen]=useState(false);
  return <>
    <a className="skip-link" href="#analyse">Direkt zur Analyse</a>
    <header className="header home-header">
      <a className="brand" href="/" aria-label="QONSUL Startseite"><Brand/></a>
      <nav aria-label="Hauptnavigation"><a href="#leistungen">Kompetenzen</a><a href="#methode">Unser Ansatz</a><a href="#ueber-uns">QONSUL</a><a href="#insights">Insights</a><button type="button" data-analytics-cta="navigation-contact" data-analytics-placement="navigation" onClick={()=>setContactOpen(true)}>Kontakt</button></nav>
      <a className="button button-outline header-cta" href="#analyse">Problem analysieren <span>↗</span></a>
      <button className="menu-toggle" aria-label={menu?'Menü schließen':'Menü öffnen'} aria-expanded={menu} aria-controls="main-menu" onClick={()=>setMenu(!menu)}>{menu?'×':'☰'}</button>
      {menu&&<nav className="nav-overlay" id="main-menu" aria-label="Weitere Navigation">{[['Kompetenzen','#leistungen'],['Quality Diagnostic','#analyse'],['Unser Ansatz','#methode'],['Über QONSUL','#ueber-uns'],['Insights','#insights']].map(([label,href])=><a key={href} href={href} onClick={()=>setMenu(false)}>{label}<span>↗</span></a>)}<button type="button" onClick={()=>{setMenu(false);setContactOpen(true);}}>Kontakt<span>↗</span></button></nav>}
    </header>
    <main>
      <HeroSlideshow>
        <div className="hero-content">
          <div className="eyebrow">QONSUL / DATA · QUALITY · RISK</div><div className="brand-rule" aria-hidden="true"><i/><i/><i/><i/></div>
          <h1 id="hero-title">Qualität verstehen.<br/><span>Risiken vorausdenken.</span></h1>
          <div className="hero-bottom"><p>Wir verbinden Quality Engineering, technisches Risikomanagement und Data Science. Für bessere Entscheidungen in Ihrer Produktentwicklung.</p><a className="hero-down" href="#positionierung" aria-label="QONSUL kennenlernen">↓</a></div>
          <form className="hero-launch" onSubmit={e=>{e.preventDefault();setLaunch({problem:problem.trim(),id:launch.id+1});}}>
            <label htmlFor="hero-problem">IHR PROBLEM. UNSER GEMEINSAMER AUSGANGSPUNKT.</label>
            <div><input id="hero-problem" required minLength={10} maxLength={600} value={problem} onChange={e=>setProblem(e.target.value)} placeholder="z. B. Sporadische Ausfälle bei der thermischen Validierung"/><button type="submit" data-analytics-cta="hero-analysis-start" data-analytics-placement="hero">Analyse starten <span>↗</span></button></div>
            <small>Quality Diagnostic · Ohne Anmeldung starten · Keine vertraulichen Daten eingeben</small>
          </form>
        </div>
      </HeroSlideshow>
      <section className="positioning section-wrap" id="positionierung"><div className="section-index">01 / UNSER ANSPRUCH</div><h2>Komplexe Probleme.<br/>Belastbare Entscheidungen.</h2><div className="positioning-copy"><p>Qualitätsprobleme entstehen im Zusammenspiel von Produkt, Prozess und Menschen. Ihre Lösung braucht mehr als eine einzelne Perspektive.</p><p>QONSUL verbindet präventive Qualitätsmethoden mit technischer Risikoanalyse und Daten. Wir machen Zusammenhänge sichtbar, prüfen Hypothesen und helfen Ihrem Team, wirksame Maßnahmen zu priorisieren.</p></div></section>
      <SiteContent/>
      <section className="diagnostic-section"><div className="section-wrap diagnostic-heading"><span className="section-index">05 / QUALITY DIAGNOSTIC</span><h2>Der erste Schritt<br/>ist eine gute Frage.</h2><p>Bringen Sie Ihr Qualitätsproblem mit. Gemeinsam werden aus Beobachtungen prüfbare Hypothesen.</p></div><IshikawaLab launch={launch}/></section>
      <section className="bottom-cta" id="kontakt"><div><div className="eyebrow">VON DER ANALYSE ZUR VERÄNDERUNG</div><h2>Was möchten Sie<br/>besser verstehen?</h2><p>Strukturieren Sie Ihre Herausforderung und nehmen Sie die Analyse als Grundlage für Ihr Team oder ein Gespräch mit QONSUL mit.</p></div><button type="button" className="button button-lime" onClick={()=>setContactOpen(true)}>Kontakt aufnehmen ↗</button></section>
    </main>
    <footer className="site-footer"><div className="footer-top"><a className="brand" href="/"><Brand/></a><p>Data. Quality. Risk.<br/>Bessere Entscheidungen beginnen hier.</p><nav aria-label="Footernavigation"><a href="#leistungen">Kompetenzen</a><a href="#ueber-uns">Über QONSUL</a><a href="#insights">Insights</a><button type="button" data-analytics-cta="footer-contact" data-analytics-placement="footer" onClick={()=>setContactOpen(true)}>Kontakt</button></nav></div><div className="footer-bottom"><span>© {new Date().getFullYear()} QONSUL Managementberatung</span><div><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a></div></div></footer>
    <ContactDialog open={contactOpen} onClose={()=>setContactOpen(false)}/>
  </>;
}
