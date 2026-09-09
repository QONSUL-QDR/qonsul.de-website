export type Phase3cAnalyticsHook='contact_form_started'|'contact_form_submitted'|'contact_form_accepted'|'contact_form_failed'|'ishikawa_started'|'ishikawa_completed'|'ishikawa_accepted'|'diagnostic_started'|'diagnostic_step_completed'|'diagnostic_completed';
export type AnalyticsHookDetail={diagnosticFlowId?:string;stepKey?:'problem'|'causes'|'report';stepSequence?:number};
export function emitAnalyticsHook(name:Phase3cAnalyticsHook,detail:AnalyticsHookDetail={}){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('qonsul:analytics-hook',{detail:{name,...detail}}));}

export function conversionForAnalyticsHook(name: Phase3cAnalyticsHook): 'website_goal' | null {
  return name === 'contact_form_accepted' || name === 'ishikawa_accepted' || name === 'diagnostic_completed' ? 'website_goal' : null;
}
