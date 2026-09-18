'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { readConsultationCorrectionLink, storeConsultationCorrectionLink } from '@/lib/consultation-correction-storage';

const createToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export default function ManageRequestEmailPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [success, setSuccess] = useState(false);
  const correctionId = useRef('');
  const nextToken = useRef('');

  useEffect(() => {
    readConsultationCorrectionLink();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice('');
    if (!correctionId.current) correctionId.current = crypto.randomUUID();
    if (!nextToken.current) nextToken.current = createToken();
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch('/api/diagnostic-email-correction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ token: params.token, correctionId: correctionId.current, nextToken: nextToken.current, email: form.get('email') }),
      });
      const result = await response.json() as { error?: string; correctionPath?: string };
      if (!response.ok || !result.correctionPath) throw new Error(result.error);
      storeConsultationCorrectionLink(result.correctionPath);
      router.replace(result.correctionPath);
      setSuccess(true);
      setNotice('Die E-Mail-Adresse wurde korrigiert. Eine neue Bestätigungs-E-Mail wurde angefordert.');
    } catch {
      setNotice('Der Korrektur-Link ist ungültig oder abgelaufen. Eine Anfrage kann nicht angezeigt werden.');
    } finally { setBusy(false); }
  }

  return <main className="legal-page">
    <span className="eyebrow">ANFRAGE VERWALTEN</span>
    <h1>E-Mail-Adresse korrigieren</h1>
    <p>Hier können Sie ausschließlich die Empfangsadresse Ihrer Bestätigungs-E-Mail berichtigen. Inhalte Ihrer Anfrage werden nicht angezeigt.</p>
    {!success && <form className="lead-form" onSubmit={submit}>
      <div className="lead-fields"><label>Neue E-Mail-Adresse<input name="email" type="email" required maxLength={254} autoComplete="email" /></label></div>
      <div className="lead-submit"><span>Der Link ist sieben Tage gültig und kann nur einmal verwendet werden.</span><button className="button button-green" disabled={busy}>{busy ? 'Korrektur wird übermittelt …' : 'E-Mail-Adresse korrigieren'}</button></div>
    </form>}
    {notice && <p role="status" className={success ? 'crm-notice' : 'error-message'}>{notice}</p>}
    <p><Link href="/">Zurück zu QONSUL</Link></p>
  </main>;
}
