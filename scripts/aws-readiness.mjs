// Read-only AWS account discovery. Never creates resources or reads secret values.
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: pnpm aws:readiness --profile PROFILE --region REGION\nRequires AWS CLI v2 and an authenticated non-root profile. Only account, SES, RDS and budget metadata is read.');
  process.exit(0);
}
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--profile', '--region'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('-')) {
    console.error('Provide --profile PROFILE and --region REGION. No credentials belong in these arguments.');
    process.exit(2);
  }
  options[args[i].slice(2)] = args[i + 1];
}
if (!options.profile || !/^[a-z0-9-]+-\d+$/.test(options.region || '')) {
  console.error('An explicit AWS profile and region are required. Run with --help for usage.');
  process.exit(2);
}
function aws(serviceArgs, region = options.region) {
  const result = spawnSync('aws', [...serviceArgs, '--profile', options.profile, '--region', region, '--output', 'json', '--no-cli-pager', '--cli-connect-timeout', '5', '--cli-read-timeout', '10'], {
    encoding: 'utf8', timeout: 20000, maxBuffer: 1024 * 1024,
    env: { ...process.env, AWS_PAGER: '', AWS_CLI_AUTO_PROMPT: 'off' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error?.code === 'ENOENT') return { ok: false, reason: 'AWS CLI v2 is not installed or is not on PATH.' };
  if (result.status !== 0) {
    // Do not echo CLI stderr: external credential helpers can include sensitive data.
    const kind = ['AccessDenied', 'ExpiredToken', 'InvalidClientTokenId', 'Unauthorized', 'UnrecognizedClient'].find(value => result.stderr?.includes(value));
    return { ok: false, reason: kind || 'Unavailable: check CLI version, profile authentication, permissions and region.' };
  }
  try { return { ok: true, value: JSON.parse(result.stdout) }; }
  catch { return { ok: false, reason: 'AWS CLI did not return JSON.' }; }
}
const identity = aws(['sts', 'get-caller-identity']);
if (!identity.ok) { console.error(identity.reason); process.exit(2); }
if (!/^\d{12}$/.test(identity.value.Account) || identity.value.Arn?.endsWith(':root')) {
  console.error('Use an authenticated non-root AWS profile before continuing.'); process.exit(2);
}
const checks = {};
const plan = aws(['freetier', 'get-account-plan-state'], 'us-east-1');
checks.plan = plan.ok ? { known: true, type: plan.value.accountPlanType, status: plan.value.accountPlanStatus, credits: plan.value.accountPlanRemainingCredits, expiresAt: plan.value.accountPlanExpirationDate } : { known: false, reason: plan.reason };
const email = aws(['sesv2', 'get-account']);
checks.email = email.ok ? { known: true, sendingEnabled: email.value.SendingEnabled, productionAccess: email.value.ProductionAccessEnabled, quota: email.value.SendQuota } : { known: false, reason: email.reason };
const identities = aws(['sesv2', 'list-email-identities']);
checks.senderIdentities = identities.ok ? { known: true, verifiedCount: identities.value.EmailIdentities?.filter(x => x.SendingEnabled).length ?? 0 } : { known: false, reason: identities.reason };
const databases = aws(['rds', 'describe-db-instances']);
checks.databases = databases.ok ? { known: true, instances: databases.value.DBInstances?.map(x => ({ id: x.DBInstanceIdentifier, engine: x.Engine, version: x.EngineVersion, size: x.DBInstanceClass, storageGiB: x.AllocatedStorage, public: x.PubliclyAccessible, multiAZ: x.MultiAZ })) ?? [] } : { known: false, reason: databases.reason };
const budgets = aws(['budgets', 'describe-budgets', '--account-id', identity.value.Account], 'us-east-1');
checks.budgets = budgets.ok ? { known: true, count: budgets.value.Budgets?.length ?? 0 } : { known: false, reason: budgets.reason };
console.log(JSON.stringify({ accountId: identity.value.Account, profile: options.profile, region: options.region, checks,
  status: 'REVIEW_REQUIRED',
  note: 'No resources, emails, secret values or database contents were created, sent, read or changed. This report is not a price estimate or a free-tier guarantee. Verify remaining credits, service eligibility, projected usage and source database before provisioning.',
}, null, 2));
if (Object.values(checks).some(check => !check.known)) process.exitCode = 2;
