import { assertEvidenceUrl } from '../lib/production-deployment.mjs';

assertEvidenceUrl(process.env.PRODUCTION_D1_BACKUP_EVIDENCE_URL || '', 'Production D1 backup evidence');
assertEvidenceUrl(process.env.PRODUCTION_ROLLBACK_EVIDENCE_URL || '', 'Rollback evidence');
