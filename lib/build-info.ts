// Non-sensitive deployment-drift identifier. `__QONSUL_BUILD_COMMIT_SHA__`
// is inlined by vite.config.ts's `define` from the commit that produced the
// current build (see that file for the resolution order). Never a secret —
// exposed publicly via GET /api/status so that, given only the Worker URL,
// the commit actually running can be confirmed rather than assumed.
//
// `typeof` is deliberate: outside a Vite build (e.g. a test script executed
// directly with plain `node`) the global does not exist at all, and
// `typeof` on an undeclared identifier returns 'undefined' instead of
// throwing, so this module is always safe to import.
export const BUILD_COMMIT_SHA: string =
  typeof __QONSUL_BUILD_COMMIT_SHA__ === 'string' && __QONSUL_BUILD_COMMIT_SHA__ ? __QONSUL_BUILD_COMMIT_SHA__ : 'unknown';
