'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { heroImage, heroSlides } from '@/lib/hero-slides';

const DWELL_MS = 8000;
const FADE_MS = 1200;
const subscribeNever = () => () => {};
const falseSnapshot = () => false;
const trueSnapshot = () => true;

function subscribeToReducedMotion(onChange: () => void) {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  motion.addEventListener('change', onChange);
  return () => motion.removeEventListener('change', onChange);
}

function reducedMotionSnapshot() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function visibilitySnapshot() {
  return !document.hidden;
}

export default function HeroSlideshow({ children }: { children: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const cache = useRef(new Map<string, Promise<void>>());
  const [frame, setFrame] = useState<{ current: number; previous: number | null }>({ current: 0, previous: null });
  const [requested, setRequested] = useState(0);
  const [paused, setPaused] = useState(() => typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData));
  const [inView, setInView] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [manualRequest, setManualRequest] = useState(false);
  const ready = useSyncExternalStore(subscribeNever, trueSnapshot, falseSnapshot);
  const reducedMotion = useSyncExternalStore(subscribeToReducedMotion, reducedMotionSnapshot, falseSnapshot);
  const visible = useSyncExternalStore(subscribeToVisibility, visibilitySnapshot, trueSnapshot);
  const { current, previous } = frame;
  const playing = ready && !paused && !reducedMotion && visible && inView && !editing;
  const slide = heroSlides[current];
  const pending = requested !== current;

  useEffect(() => {
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting), { threshold: 0.1 },
    );
    if (section.current) observer?.observe(section.current);
    return () => observer?.disconnect();
  }, []);

  const load = useCallback((index: number) => {
    const src = heroImage(index, window.matchMedia('(max-width: 700px)').matches);
    const existing = cache.current.get(src);
    if (existing) return existing;
    const promise = new Promise<void>((resolve, reject) => {
      const img = new Image();
      const timeout = window.setTimeout(() => finish(new Error('Image timeout')), 15000);
      const finish = (failure?: Error) => {
        window.clearTimeout(timeout); img.onload = null; img.onerror = null;
        if (failure) reject(failure); else resolve();
      };
      img.decoding = 'async';
      img.onload = () => {
        // Decode before changing the visible frame; the current image stays on screen on failure.
        img.decode().then(() => finish(), () => finish(new Error('Image decode')));
      };
      img.onerror = () => finish(new Error('Image load'));
      img.src = src;
    });
    cache.current.set(src, promise);
    promise.catch(() => cache.current.delete(src));
    return promise;
  }, []);

  useEffect(() => {
    if (!playing || pending || previous !== null) return;
    // Fetch only the next motif after the first viewport has had time to load.
    const preload = window.setTimeout(() => { void load((current + 1) % heroSlides.length).catch(() => {}); }, 2000);
    const rotate = window.setTimeout(() => {
      setManualRequest(false);
      setRequested((current + 1) % heroSlides.length);
    }, DWELL_MS);
    return () => { window.clearTimeout(preload); window.clearTimeout(rotate); };
  }, [playing, pending, current, previous, load]);

  useEffect(() => {
    if (!pending || (!manualRequest && !playing)) return;
    let cancelled = false;
    void load(requested).then(() => {
      if (cancelled) return;
      setFrame(value => ({ current: requested, previous: reducedMotion ? null : value.current }));
      setError('');
    }).catch(() => {
      if (cancelled) return;
      setError('Dieses Motiv konnte nicht geladen werden. Bitte wählen Sie eine andere Branche.');
      setRequested(current); setPaused(true);
    });
    return () => { cancelled = true; };
  }, [requested, pending, manualRequest, playing, current, reducedMotion, load]);

  useEffect(() => {
    if (previous === null) return;
    const timer = window.setTimeout(() => setFrame(value => ({ ...value, previous: null })), reducedMotion ? 0 : FADE_MS);
    return () => window.clearTimeout(timer);
  }, [current, previous, reducedMotion]);

  function choose(index: number) {
    setManualRequest(true);
    setPaused(true); setError('');
    setRequested((index + heroSlides.length) % heroSlides.length);
  }

  function toggle() {
    // Cancel a pending automatic request when pausing; resuming always gives a full dwell interval.
    setManualRequest(false);
    setRequested(current); setError(''); setPaused(value => !value);
  }

  return <section ref={section} className="hero cinematic-hero industry-hero" aria-labelledby="hero-title"
    onFocusCapture={event => {
      if ((event.target as HTMLElement).matches('input, textarea')) setEditing(true);
    }}
    onBlurCapture={event => {
      if (!(event.relatedTarget instanceof HTMLElement) || !event.relatedTarget.matches('input, textarea')) setEditing(false);
    }}>
    <div className="hero-media" id="hero-industry-image">
      {[previous, current].filter((index): index is number => index !== null).map(index => <picture
        key={heroSlides[index].id}
        className={`hero-frame ${index === current ? 'is-current' : 'is-previous'} ${index === current && previous !== null ? 'is-entering' : ''}`}
        aria-hidden={index !== current}>
        <source media="(max-width: 700px)" srcSet={heroImage(index, true)}/>
        <img src={heroImage(index)} alt={index === current ? heroSlides[index].alt : ''}
          width="1920" height="1200" fetchPriority={index === 0 ? 'high' : 'auto'}
          decoding={index === 0 ? 'auto' : 'async'} style={{ objectPosition: heroSlides[index].position || '50% 50%' }}/>
      </picture>)}
    </div>
    {children}
    <div className="industry-strip" role="group" aria-roledescription="Bildfolge" aria-label="QONSUL Zielbranchen">
      <div className="industry-caption" aria-live={paused || reducedMotion ? 'polite' : 'off'} aria-atomic="true">
        <span className="industry-kicker">INDUSTRIELLE QUALITÄT / <span>{String(current + 1).padStart(2, '0')} — {heroSlides.length}</span></span>
        <strong>{slide.industry}</strong>
        <span className="industry-focus">{slide.focus}</span>
      </div>
      <div className="industry-navigation">
        <label className="industry-select"><span>Branche wählen</span>
          <select aria-label="Branchenmotiv direkt auswählen" value={requested}
            onFocus={() => setPaused(true)} onChange={event => choose(Number(event.target.value))}>
            {heroSlides.map((item, index) => <option key={item.id} value={index}>{String(index + 1).padStart(2, '0')} / {item.industry}</option>)}
          </select><span className="industry-select-arrow" aria-hidden="true">⌄</span>
        </label>
        <div className="industry-buttons">
          <button type="button" aria-label="Vorheriges Branchenmotiv" aria-controls="hero-industry-image" onFocus={() => setPaused(true)} onClick={() => choose(requested - 1)}>←</button>
          <button type="button" className="industry-play" disabled={!ready || reducedMotion}
            aria-label={reducedMotion ? 'Automatischer Bildwechsel bei reduzierter Bewegung deaktiviert' : paused ? 'Automatischen Bildwechsel starten' : 'Automatischen Bildwechsel pausieren'}
            onClick={toggle}>
            <span aria-hidden="true">{paused || reducedMotion ? '▷' : 'Ⅱ'}</span>
            <span>{reducedMotion ? 'Manuell' : paused ? 'Start' : 'Pause'}</span>
          </button>
          <button type="button" aria-label="Nächstes Branchenmotiv" aria-controls="hero-industry-image" onFocus={() => setPaused(true)} onClick={() => choose(requested + 1)}>→</button>
        </div>
      </div>
      <div className="industry-progress" aria-hidden="true"><i key={current}
        className={playing && !pending && previous === null ? 'is-running' : ''}/></div>
      <span className="industry-status" role="status" aria-live={manualRequest || error ? 'polite' : 'off'}>{error || (pending ? 'Motiv wird geladen …' : editing ? 'Bildwechsel während der Eingabe pausiert' : '')}</span>
    </div>
  </section>;
}
