// Public, approved Worker vars for sealed Production candidates only.
// This is not a secret store or a configuration source for local/Sites previews.
export const PRODUCTION_PUBLIC_RUNTIME_V1 = Object.freeze({
  PRODUCTION_READY: 'true',
  PUBLIC_CONTACT_EMAIL: 'info@qonsul.de',
  LEGAL_ENTITY_NAME: 'QONSUL Managementberatung UG (haftungsbeschränkt)',
  LEGAL_ADDRESS: 'Unterboihinger Straße 24, 72644 Oberboihingen, Deutschland',
  LEGAL_REPRESENTATIVE: 'Raphael Zajonz, Geschäftsführer',
  LEGAL_PHONE: '+49 7022 9686-004',
  LEGAL_REGISTER: 'Amtsgericht Stuttgart, HRB 781990',
  LEGAL_VAT_ID: 'DE348271542',
  LEGAL_EDITORIAL_RESPONSIBLE: 'Raphael Zajonz, Unterboihinger Straße 24, 72644 Oberboihingen',
  LEGAL_DISPUTE_RESOLUTION: 'Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
});

export function assertProductionPublicRuntimeVars(vars) {
  const expected = PRODUCTION_PUBLIC_RUNTIME_V1;
  if (!vars || typeof vars !== 'object' || Array.isArray(vars)) {
    throw new Error('Artifact Worker vars are missing or invalid.');
  }
  const actualKeys = Object.keys(vars).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error('Artifact Worker vars do not contain exactly the approved public Production keys.');
  }
  for (const key of expectedKeys) {
    if (vars[key] !== expected[key]) {
      throw new Error(`Artifact Worker var ${key} differs from the approved public Production value.`);
    }
  }
}
