export const demoLogins = [
 { username: 'admin', name: 'Administrator', description: 'Platform overview and payment review', href: '#/admin/overview', icon: 'shield' },
 { username: 'single user', name: 'Personal owner', description: 'Your own storage workspace', href: '#/app/overview?role=personal-owner', icon: 'users' },
 { username: 'family user', name: 'Family owner', description: 'A shared household workspace', href: '#/app/overview?role=family-owner', icon: 'users' },
 { username: 'support', name: 'System Support', description: 'Cases and redacted diagnostics', href: '#/support/overview', icon: 'activity' },
 { username: 'editor', name: 'Family editor', description: 'Edit explicitly shared sample boxes', href: '#/app/overview?role=family-editor', icon: 'receipt' },
 { username: 'viewer', name: 'Family viewer', description: 'Browse shared sample boxes, read only', href: '#/app/overview?role=family-viewer', icon: 'grid' },
 { username: 'payment reviewer', name: 'Payment reviewer', description: 'Sample payment review queue', href: '#/admin/payments', icon: 'wallet' },
 { username: 'operations', name: 'Operations admin', description: 'Operational metadata preview', href: '#/admin/overview', icon: 'activity' },
 { username: 'security', name: 'Security admin', description: 'Planned security screens in the role map', href: '#/sitemap?role=security-admin', icon: 'shield' },
 { username: 'developer', name: 'Developer', description: 'Public mock Playground', href: 'https://boxvault-playground-argee-2026.web.app', icon: 'settings' },
];
export function findDemoLogin(username: string) {
 const normalized = username.trim().toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');
 const aliases: Record<string, string> = { administrator: 'admin', personal: 'single user', single: 'single user', user: 'single user', singleuser: 'single user', 'personal owner': 'single user', family: 'family user', familyuser: 'family user', 'family owner': 'family user', 'system support': 'support', systemsupport: 'support', 'family editor': 'editor', 'family viewer': 'viewer', payments: 'payment reviewer', 'operations admin': 'operations', ops: 'operations', 'security admin': 'security', dev: 'developer' };
 return demoLogins.find(role => role.username === (aliases[normalized] ?? normalized));
}
