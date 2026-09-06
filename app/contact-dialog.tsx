'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import {CONTACT_PRIVACY_VERSION} from '@/lib/contact';
import {emitAnalyticsHook} from '@/lib/analytics-hooks';
import {currentAnalyticsSessionId} from '@/lib/analytics-session';

type Status={productionReady:boolean;contactReady:boolean;contactEmail:string};
type Result={status:'accepted';reference:string};

export default function ContactDialog({open,onClose}:{open:boolean;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),firstField=useRef<HTMLInputElement>(null),token=useRef('');
  const [status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null);
  useEffect(()=>{if(!open){if(dialog.current?.open)dialog.current.close();return;}emitAnalyticsHook('contact_form_started');token.current=crypto.randomUUID();queueMicrotask(()=>{setError('');setResult(null);setBusy(false);});fetch('/api/status').then(async r=>await r.json() as Status).then(setStatus).catch(()=>setStatus({productionReady:false,contactReady:false,contactEmail:'info@qonsul.de'}));dialog.current?.showModal();requestAnimationFrame(()=>firstField.current?.focus());},[open]);
  const close=()=>{dialog.current?.close();onClose();};
  const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();emitAnalyticsHook('contact_form_submitted');setBusy(true);setError('');const form=new FormData(event.currentTarget);try{const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:form.get('name'),email:form.get('email'),phone:form.get('phone'),company:form.get('company'),message:form.get('message'),website:form.get('website'),privacyAcknowledged:form.get('privacy')==='on',privacyVersion:CONTACT_PRIVACY_VERSION,demoConfirmed:form.get('demo')==='on',clientToken:token.current,analyticsSessionId:currentAnalyticsSessionId()})});const data=await response.json() as Result&{error?:string};if(!response.ok)throw new Error(data.error||'Die Anfrage konnte nicht gesendet werden.');emitAnalyticsHook('contact_form_accepted');setResult(data);}catch(cause){emitAnalyticsHook('contact_form_failed');setError(cause instanceof Error?cause.message:'Die Anfrage konnte nicht gesendet werden.');}finally{setBusy(false);}};
  return <dialog ref={dialog} className="contact-dialog" aria-labelledby="contact-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
    <div className="contact-card">
      <button type="button" className="contact-close" onClick={close} aria-label="Kontaktformular schließen">×</button>
      <div className="eyebrow">DIREKTER AUSTAUSCH</div><h2 id="contact-title">Worüber möchten Sie<br/>mit uns sprechen?</h2>
      {result?<div className="contact-success" role="status"><span aria-hidden="true">✓</span><h3>Ihre Anfrage ist gespeichert.</h3><p>{status?.productionReady?'Ihre Anfrage wurde sicher an QONSUL übermittelt.':'Dies ist eine fiktive Testanfrage im privaten Vorschaudatenspeicher. Es wurde nichts an das QONSUL Cockpit oder per E-Mail übertragen.'}</p><button type="button" className="button button-dark" onClick={close}>Schließen</button></div>:<form onSubmit={submit}>
        {!status?.productionReady&&<p className="preview-note">Private Vorschau: Bitte ausschließlich fiktive Testdaten eintragen. CRM- und E-Mail-Zustellung bleiben deaktiviert.</p>}
        <div className="contact-fields"><label>Ihr Name *<input ref={firstField} name="name" autoComplete="name" required minLength={2} maxLength={100}/></label><label>E-Mail-Adresse *<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><label>Telefonnummer <span>(optional)</span><input name="phone" type="tel" autoComplete="tel" maxLength={50}/></label><label>Unternehmen <span>(optional)</span><input name="company" autoComplete="organization" maxLength={150}/></label></div>
        <label className="contact-message">Kurze Nachricht *<textarea name="message" required minLength={10} maxLength={2000} rows={5} placeholder="Welche Qualitäts-, Risiko- oder Datenfrage beschäftigt Sie?"/></label>
        <label className="honey" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
        <label className="check-label"><input name="privacy" type="checkbox" required/><span>Ich habe die <a href="/datenschutz" target="_blank">Datenschutzhinweise</a> gelesen. Die Angaben werden zur Bearbeitung meiner Anfrage verarbeitet.</span></label>
        {!status?.productionReady&&<label className="check-label"><input name="demo" type="checkbox" required/><span>Ich bestätige, ausschließlich fiktive Testdaten zu verwenden.</span></label>}
        {error&&<p className="contact-error" role="alert">{error}</p>}
        <div className="contact-submit"><small>Pflichtfelder sind mit * gekennzeichnet. Telefonnummer und Unternehmen sind freiwillig.</small><button className="button button-dark" disabled={busy}>{busy?'Wird sicher gespeichert …':'Nachricht senden ↗'}</button></div>
      </form>}
    </div>
  </dialog>;
}
