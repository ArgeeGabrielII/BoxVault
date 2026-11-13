const project = process.env.FIREBASE_SPARK_PROJECT_ID;
const token = process.env.BILLING_ACCESS_TOKEN;
if (!project || !/^[a-z][a-z0-9-]{4,29}$/.test(project) || !token)
  throw new Error('Missing project or billing verification credential; deployment denied');
const response = await fetch(
  'https://cloudbilling.googleapis.com/v1/projects/' + encodeURIComponent(project) + '/billingInfo',
  {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  },
);
if (!response.ok) throw new Error('Unable to verify billing (HTTP ' + response.status + '); deployment denied');
const billing = await response.json();
if (billing.billingEnabled !== false || billing.billingAccountName)
  throw new Error('A billing account may be linked or billing is not explicitly disabled; deployment denied');
console.log('Verified that project billing is disabled and no billing account is linked');
