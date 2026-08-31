export type HeroSlide = {
  id: string;
  industry: string;
  focus: string;
  alt: string;
  author: string;
  source: string;
  position?: string;
};

// Priority 1 → 2 → 3. Photographs illustrate sectors, not QONSUL client projects.
export const heroSlides: HeroSlide[] = [
  {
    id: 'automotive', industry: 'Automotive & Zulieferer',
    focus: 'Ausschussprognose · Supplier Risk · Reklamationsanalyse',
    alt: 'Industrieroboter in einer abgesicherten automobilen Fertigungszelle',
    author: 'Simon Kadula', source: 'https://unsplash.com/photos/a-factory-filled-with-lots-of-orange-machines-8gr6bObQLOI',
  },
  {
    id: 'machinery', industry: 'Maschinen- & Anlagenbau',
    focus: 'Qualitätsfrühwarnung · Warranty Risk · Testdatenanalyse',
    alt: 'Präzisionswerkzeug über einem gefrästen Metallbauteil',
    author: 'Jelifer Maniago', source: 'https://unsplash.com/photos/a-machine-that-is-cutting-a-piece-of-metal-O5rSp_U-Pa0',
  },
  {
    id: 'electronics', industry: 'Elektrotechnik / Elektronik / Automation',
    focus: 'Test-Analytics · Process Drift · Supplier Quality',
    alt: 'Makroaufnahme einer unbestückten Leiterplatte mit vergoldeten Kontaktflächen',
    author: 'Vishnu Mohanan', source: 'https://unsplash.com/photos/close-up-of-dark-blue-circuit-board-pfR18JNEMv8',
  },
  {
    id: 'energy', industry: 'Energie / Wind / Wasserstoff',
    focus: 'Reliability Risk · FMEA / FTA · Predictive Maintenance',
    alt: 'Offshore-Windpark mit dreiblättrigen Windenergieanlagen im Meer',
    author: 'Nicholas Doherty', source: 'https://unsplash.com/photos/pONBhDyOFoM',
    position: '65% 50%',
  },
  {
    id: 'medtech', industry: 'MedTech',
    focus: 'CAPA-Analytics · Complaint Trends · Validation Risk',
    alt: 'Medizinisches Strahlentherapie-System mit leerer Patientenliege in einem Behandlungsraum',
    author: 'Accuray', source: 'https://unsplash.com/photos/medical-radiation-therapy-machine-in-clinic-QTP8UKW_PgI',
    position: '65% 50%',
  },
  {
    id: 'pharma', industry: 'Pharma / Life Sciences',
    focus: 'Deviation Analytics · Batch Risk · Process Monitoring',
    alt: 'Behandschuhte Laborhand mit einer Kapsel an einem pharmazeutischen Prüfgerät',
    author: 'Mina Rad', source: 'https://unsplash.com/photos/y6zGvWKU6sE',
    position: '65% 50%',
  },
  {
    id: 'aerospace', industry: 'Aerospace & Defence',
    focus: 'FMEA / FTA · Reliability · Test & Qualification Analytics',
    alt: 'Nahaufnahme des Fans eines Flugzeugtriebwerks mit regelmäßig angeordneten Schaufeln',
    author: 'Felix Berger', source: 'https://unsplash.com/photos/a-close-up-view-of-a-jet-engine-PfYaLrYS1Oc',
  },
  {
    id: 'chemical', industry: 'Prozessindustrie / Chemie',
    focus: 'Process Risk · Anomaly Detection · Predictive Maintenance',
    alt: 'Industrieller Anlagenkomplex mit Rohrleitungen, Kolonnen und Behältern',
    author: 'Hazel J', source: 'https://unsplash.com/photos/vast-industrial-complex-with-pipes-tanks-and-buildings-9KeG7W4cI5U',
  },
  {
    id: 'semiconductor', industry: 'Halbleiter / High-Tech Manufacturing',
    focus: 'Yield Prediction · Process Drift · Root Cause Analytics',
    alt: 'Makroaufnahme wiederkehrender Chipstrukturen auf einem Siliziumwafer',
    author: 'Maxence Pira', source: 'https://unsplash.com/photos/a-close-up-of-a-computer-6PYPTe9fesI',
  },
  {
    id: 'building', industry: 'Aufzüge / Building Technology',
    focus: 'Field Failure Risk · Testdaten · Predictive Service',
    alt: 'Zwei metallverkleidete Aufzugstüren mit Stockwerksanzeigen und Ruftasten',
    author: 'Marcus Ganahl', source: 'https://unsplash.com/photos/a-group-of-brown-doors-6KLyD-cUFhc',
  },
  {
    id: 'food', industry: 'Lebensmittel / Verpackung',
    focus: 'Prozessabweichungen · Ausschuss · Predictive Quality',
    alt: 'Automatisierte Abfüllanlage mit einem Kunststoffbehälter auf einem Förderband',
    author: 'Mina Rad', source: 'https://unsplash.com/photos/bottles-being-filled-on-an-automated-production-line-GiuvVfcNFzY',
  },
  {
    id: 'rail', industry: 'Bahn / Mobility',
    focus: 'RAMS · Reliability · Failure Analytics',
    alt: 'Blick auf ein elektrifiziertes Gleisfeld mit Weichen und Kreuzungen',
    author: 'Lois Hill', source: 'https://unsplash.com/photos/overhead-view-of-complex-train-tracks-at-dusk-3pWCaJfy2HA',
  },
];

export const heroImage = (index: number, mobile = false) =>
  `/industries/${heroSlides[index].id}${mobile ? '-mobile' : ''}.webp`;
