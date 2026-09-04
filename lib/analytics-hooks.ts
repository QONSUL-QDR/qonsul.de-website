export type Phase3cAnalyticsHook='contact_form_started'|'contact_form_submitted'|'contact_form_accepted'|'contact_form_failed'|'ishikawa_started'|'ishikawa_completed'|'ishikawa_accepted';
export function emitAnalyticsHook(name:Phase3cAnalyticsHook){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('qonsul:analytics-hook',{detail:{name}}));}
