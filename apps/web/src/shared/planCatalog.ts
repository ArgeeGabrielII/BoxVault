export type BillingPeriod = 'monthly' | 'annually';
export const planCatalog = [
  { id: 'free', name: 'Free User', monthly: 0, annually: 0, description: 'A simple place to start organizing.', features: ['Limited storage containers', 'Supported by advertisements'] },
  { id: 'single', name: 'Single User', monthly: 119, annually: 999, description: 'Your own space, organized your way.', features: ['1 user', 'Storage organization', 'Inventory and location previews'] },
  { id: 'family', name: 'Family User', monthly: 219, annually: 1999, description: 'A little more order for your household.', features: ['Up to 4 users, including the owner', 'Shared family workspace', 'Permission-based sharing design'] },
] as const;
export const planPrice = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount);

export const annualSavings = (plan: { monthly: number; annually: number }) => { const monthlyYear = plan.monthly * 12; const amount = monthlyYear - plan.annually; return { amount, percent: monthlyYear ? Math.round(amount / monthlyYear * 100) : 0 }; };
