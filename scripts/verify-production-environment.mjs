import { assertProductionEnvironment } from '../lib/production-artifact.mjs';

assertProductionEnvironment({
  workerName: process.env.PRODUCTION_WORKER_NAME || '',
  d1DatabaseId: process.env.PRODUCTION_D1_DATABASE_ID || '',
  d1DatabaseName: process.env.PRODUCTION_D1_DATABASE_NAME || '',
  publicSiteUrl: process.env.PUBLIC_SITE_URL || '',
});

process.stdout.write('Production artifact environment is structurally separated from staging.\n');
