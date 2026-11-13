export type Account = { id: string; name: string; email: string; plan: 'Personal' | 'Family'; status: 'Active' | 'Expired'; members: number; renews: string; credits: number; joined: string };
export type Payment = { id: string; accountId: string; amount: number; credits: number; reference: string; submitted: string; status: 'Pending' | 'Approved' | 'Rejected'; note: string };
export type AuditEvent = { id: string; category: 'Billing' | 'Access' | 'Security'; title: string; detail: string; time: string; actor: string };
export const initialAccounts: Account[] = [
  { id: 'DEMO-001', name: 'Alex Rivera', email: 'alex@example.invalid', plan: 'Family', status: 'Active', members: 4, renews: 'Nov 28, 2026', credits: 2000, joined: 'Sep 12, 2026' },
  { id: 'DEMO-002', name: 'Jamie Cruz', email: 'jamie@example.invalid', plan: 'Personal', status: 'Active', members: 1, renews: 'Dec 04, 2026', credits: 1000, joined: 'Sep 18, 2026' },
  { id: 'DEMO-003', name: 'Taylor Santos', email: 'taylor@example.invalid', plan: 'Family', status: 'Active', members: 3, renews: 'Jan 16, 2027', credits: 250, joined: 'Oct 02, 2026' },
  { id: 'DEMO-004', name: 'Sam Reyes', email: 'sam@example.invalid', plan: 'Personal', status: 'Expired', members: 1, renews: 'Nov 05, 2026', credits: 0, joined: 'Aug 21, 2026' },
  { id: 'DEMO-005', name: 'Morgan Lee', email: 'morgan@example.invalid', plan: 'Personal', status: 'Active', members: 1, renews: 'Feb 08, 2027', credits: 500, joined: 'Oct 08, 2026' },
  { id: 'DEMO-006', name: 'Casey Ramos', email: 'casey@example.invalid', plan: 'Family', status: 'Active', members: 2, renews: 'Mar 19, 2027', credits: 750, joined: 'Oct 19, 2026' },
  { id: 'DEMO-007', name: 'Jordan Lim', email: 'jordan@example.invalid', plan: 'Personal', status: 'Expired', members: 1, renews: 'Oct 31, 2026', credits: 100, joined: 'Jul 31, 2026' },
  { id: 'DEMO-008', name: 'Riley Tan', email: 'riley@example.invalid', plan: 'Personal', status: 'Active', members: 1, renews: 'Apr 02, 2027', credits: 0, joined: 'Nov 02, 2026' },
];
export const initialPayments: Payment[] = [
  { id: 'PAY-1048', accountId: 'DEMO-003', amount: 2000, credits: 2000, reference: 'DEMO-REF-048', submitted: 'Nov 13, 09:42', status: 'Pending', note: '' },
  { id: 'PAY-1047', accountId: 'DEMO-005', amount: 1000, credits: 1000, reference: 'DEMO-REF-047', submitted: 'Nov 13, 09:18', status: 'Pending', note: '' },
  { id: 'PAY-1046', accountId: 'DEMO-008', amount: 500, credits: 500, reference: 'DEMO-REF-042', submitted: 'Nov 12, 16:35', status: 'Pending', note: '' },
  { id: 'PAY-1043', accountId: 'DEMO-002', amount: 1000, credits: 1000, reference: 'DEMO-REF-043', submitted: 'Nov 12, 14:20', status: 'Approved', note: 'Synthetic reference verified.' },
  { id: 'PAY-1042', accountId: 'DEMO-001', amount: 2000, credits: 2000, reference: 'DEMO-REF-042', submitted: 'Nov 11, 11:05', status: 'Approved', note: 'Synthetic reference verified.' },
  { id: 'PAY-1041', accountId: 'DEMO-007', amount: 500, credits: 500, reference: 'DEMO-REF-041', submitted: 'Nov 10, 15:12', status: 'Rejected', note: 'Sample amount did not match the submitted reference.' },
];
export const initialEvents: AuditEvent[] = [
  { id: 'EVT-0104', category: 'Billing', title: 'Top-up submitted', detail: 'PAY-1048 · 2,000 credits requested', time: 'Nov 13, 09:42', actor: 'Demo account 003' },
  { id: 'EVT-0103', category: 'Security', title: 'Operator MFA check passed', detail: 'Synthetic operator session · no sensitive payload recorded', time: 'Nov 13, 09:30', actor: 'Demo reviewer' },
  { id: 'EVT-0102', category: 'Billing', title: 'Top-up approved', detail: 'PAY-1043 · 1,000 credits issued', time: 'Nov 12, 14:25', actor: 'Demo reviewer' },
  { id: 'EVT-0101', category: 'Access', title: 'Subscription renewed', detail: 'DEMO-002 · Personal annual plan', time: 'Nov 12, 14:23', actor: 'Demo account 002' },
  { id: 'EVT-0100', category: 'Billing', title: 'Top-up approved', detail: 'PAY-1042 · 2,000 credits issued', time: 'Nov 11, 11:10', actor: 'Demo reviewer' },
];
export const money = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount);
export const number = (amount: number) => amount.toLocaleString('en-PH');
