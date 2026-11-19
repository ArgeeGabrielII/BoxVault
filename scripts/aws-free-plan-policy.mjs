// A deployment precondition, not a billing cap or a promise about future usage.
export function evaluateFreePlan({ identity, plan, region, now = Date.now(), estimatedUsd, reserveUsd = 20 }) {
  const reasons = [];
  if (identity?.Account !== '666734238831' || !identity?.Arn || identity.Arn.endsWith(':root')) reasons.push('Unexpected project or root identity');
  if (region !== 'ap-southeast-2') reasons.push('Regional resources must remain in Sydney');
  if (plan?.accountPlanType !== 'FREE' || plan?.accountPlanStatus !== 'ACTIVE') reasons.push('An active FREE plan is required; never upgrade automatically');
  const credits = Number(plan?.accountPlanRemainingCredits?.amount);
  if (plan?.accountPlanRemainingCredits?.unit !== 'USD' || !Number.isFinite(credits) || credits <= 0) reasons.push('Available USD credits must be verified');
  const expiry = Date.parse(plan?.accountPlanExpirationDate ?? '');
  if (!Number.isFinite(now) || !Number.isFinite(expiry) || expiry <= now) reasons.push('Free plan expiration is unknown or has passed');
  if (typeof estimatedUsd !== 'number' || !Number.isFinite(estimatedUsd) || estimatedUsd <= 0 || typeof reserveUsd !== 'number' || !Number.isFinite(reserveUsd) || reserveUsd < 20) reasons.push('A positive reviewed cost estimate and at least USD 20 reserve are required');
  else if (Number.isFinite(credits) && credits < estimatedUsd + reserveUsd) reasons.push('Estimated usage would consume the credit reserve');
  return { passed: reasons.length === 0, reasons, creditsUsd: Number.isFinite(credits) ? credits : null, expiresAt: Number.isFinite(expiry) ? new Date(expiry).toISOString() : null,
    note: 'Recheck immediately before each deployment. This does not authorize resources, cap ongoing usage, or replace AWS Free-plan protections.' };
}
