/* eslint-disable @next/next/no-html-link-for-pages -- Existing full-page home navigation is intentional. */
import Brand from '@/app/brand';
import { heroSlides } from '@/lib/hero-slides';

export const metadata = { title: 'Impressum · QONSUL' };

export default function Impressum() {
  return <>
    <header className="header"><a className="brand" href="/"><Brand /></a><a href="/" className="button button-outline">← Zur Startseite</a></header>
    <main className="legal-page">
      <div className="eyebrow">ANBIETERINFORMATIONEN</div>
      <h1>Impressum</h1>
      <section><h2>Anbieter</h2><p>QONSUL Managementberatung UG (haftungsbeschränkt)<br />Unterboihinger Straße 24<br />72644 Oberboihingen<br />Deutschland</p><p>Vertreten durch den Geschäftsführer<br />Raphael Zajonz</p></section>
      <section><h2>Kontakt</h2><p>Telefon: <a href="tel:+4970229686004">+49 7022 9686-004</a><br />E-Mail: <a href="mailto:info@qonsul.de">info@qonsul.de</a></p></section>
      <section><h2>Register und steuerliche Angaben</h2><p>Registergericht: Amtsgericht Stuttgart<br />Handelsregisternummer: HRB 781990<br />Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE348271542</p></section>
      <section><h2>Redaktionell verantwortlich</h2><p>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV:<br />Raphael Zajonz, Anschrift wie oben</p></section>
      <section id="bildnachweise"><h2>Bildnachweise</h2><p>Die Branchenmotive sind Fotografien, genutzt unter der <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash-Lizenz</a>. Sie illustrieren Anwendungsfelder und zeigen keine QONSUL-Kundenprojekte. Abgebildete Unternehmen oder Produkthersteller sind keine behaupteten Referenzen oder Partner. Grafische Konzeptdarstellungen zeigen keine Kunden- oder Projektdaten.</p><ul className="image-credits">{heroSlides.map(slide => <li key={slide.id}><strong>{slide.industry}</strong><span>{slide.alt}. Foto: <a href={slide.source} target="_blank" rel="noreferrer">{slide.author} / Unsplash ↗</a></span></li>)}</ul></section>
      <a className="text-link" href="/datenschutz">Datenschutzhinweise lesen ↗</a>
    </main>
  </>;
}
