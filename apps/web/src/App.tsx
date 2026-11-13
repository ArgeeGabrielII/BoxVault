import { useEffect, useMemo, useState } from 'react';
import logo from '@boxvault/assets/logo.svg';
import PlanPreview from './shared/PlanPreview';

type Theme = 'light' | 'dark' | 'system';
type Page = 'Overview' | 'My Boxes' | 'Inventory' | 'Locations' | 'QR Labels' | 'Family' | 'Plans & Credits' | 'Settings';
type BoxItem = { id: number; name: string; location: string; category: string; items: number; updated: string; color: string; icon: string; shared: boolean; description: string };
type Sort = 'updated' | 'name' | 'items';
const routePages: Record<string, Page> = { overview: 'Overview', boxes: 'My Boxes', inventory: 'Inventory', locations: 'Locations', labels: 'QR Labels', family: 'Family', plans: 'Plans & Credits', settings: 'Settings' };
type CustomerRole = 'personal-owner' | 'family-owner' | 'family-editor' | 'family-viewer';
const readCustomerRole = (): CustomerRole => { const value = new URLSearchParams(location.hash.split('?')[1]).get('role'); return value === 'family-owner' || value === 'family-editor' || value === 'family-viewer' ? value : 'personal-owner'; };
const customerRoleNames: Record<CustomerRole, string> = { 'personal-owner': 'Personal owner', 'family-owner': 'Family owner', 'family-editor': 'Family editor', 'family-viewer': 'Family viewer' };
const readCustomerPage = (): Page => location.hash.startsWith('#/app/') ? routePages[location.hash.split('?')[0].split('/')[2]] ?? 'Overview' : 'Overview';
const pages: { label: Page; icon: string; group: string }[] = [
  { label: 'Overview', icon: '▦', group: 'WORKSPACE' },
  { label: 'My Boxes', icon: '▣', group: 'WORKSPACE' },
  { label: 'Inventory', icon: '☷', group: 'WORKSPACE' },
  { label: 'Locations', icon: '⌖', group: 'WORKSPACE' },
  { label: 'QR Labels', icon: '▥', group: 'WORKSPACE' },
  { label: 'Family', icon: '♧', group: 'ACCOUNT' },
  { label: 'Plans & Credits', icon: '◇', group: 'ACCOUNT' },
  { label: 'Settings', icon: '⚙', group: 'ACCOUNT' },
];
const initialBoxes: BoxItem[] = [
  { id: 1001, name: 'Holiday Decorations', location: 'Storage Room · Shelf A', category: 'Seasonal', items: 18, updated: 'Today', color: 'coral', icon: '✦', shared: true, description: 'Christmas lights, ornaments and festive decorations.' },
  { id: 1002, name: 'Camping Essentials', location: 'Garage · Rack 2', category: 'Outdoor', items: 12, updated: 'Yesterday', color: 'mint', icon: '⛺', shared: true, description: 'Camping stove, sleeping bags and outdoor equipment.' },
  { id: 1003, name: 'Old Photographs', location: 'Bedroom · Closet', category: 'Keepsakes', items: 34, updated: 'Nov 8', color: 'lavender', icon: '▧', shared: false, description: 'Family photo albums and prints.' },
  { id: 1004, name: 'Kitchen Appliances', location: 'Kitchen · Upper Shelf', category: 'Kitchen', items: 8, updated: 'Nov 5', color: 'sky', icon: '♨', shared: true, description: 'Small appliances used occasionally.' },
  { id: 1005, name: 'Winter Clothes', location: 'Bedroom · Under Bed', category: 'Clothing', items: 22, updated: 'Nov 2', color: 'peach', icon: '❄', shared: false, description: 'Jackets, sweaters and scarves.' },
  { id: 1006, name: 'Tools & Hardware', location: 'Garage · Rack 1', category: 'Tools', items: 27, updated: 'Oct 29', color: 'butter', icon: '⚒', shared: true, description: 'Hand tools, tape and spare hardware.' },
];
const samples = [
  ['LED string lights','Holiday Decorations','Seasonal',2],
  ['Camping lantern','Camping Essentials','Outdoor',1],
  ['Photo album','Old Photographs','Keepsakes',4],
  ['Blender','Kitchen Appliances','Kitchen',1],
  ['Winter jacket','Winter Clothes','Clothing',3],
  ['Screwdriver set','Tools & Hardware','Tools',1],
  ['Christmas ornaments','Holiday Decorations','Seasonal',12],
  ['Sleeping bag','Camping Essentials','Outdoor',2],
];
const getInitialTheme = (): Theme => {
  try { const saved = localStorage.getItem('boxvault-theme'); return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'; }
  catch { return 'system'; }
};
function Glyph({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    close: <path d="M5 5l14 14M19 5 5 19"/>,
    chevron: <path d="m9 6 6 6-6 6"/>,
    down: <path d="m6 9 6 6 6-6"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></>,
    moon: <path d="M20 15.7A9 9 0 0 1 8.3 4 9 9 0 1 0 20 15.7Z"/>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    list: <path d="M9 5h12M9 12h12M9 19h12M3 5h2M3 12h2M3 19h2"/>,
    box: <><path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10"/></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    shield: <><path d="m12 2 8 4v6c0 5-4 8-8 10-4-2-8-5-8-10V6l8-4Z"/><path d="m8 12 3 3 5-6"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/></>,
    filter: <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>,
    check: <path d="m4 12 5 5L20 6"/>,
    qr: <><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM15 14h2m4 0v3h-4m-3 4h7"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.box}</svg>;
}
function SectionTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="section-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}
export default function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  const [page, setPage] = useState<Page>(readCustomerPage);
  const [demoRole, setDemoRole] = useState<CustomerRole>(readCustomerRole);
  useEffect(() => { const sync = () => { setPage(readCustomerPage()); setDemoRole(readCustomerRole()); }; addEventListener('hashchange', sync); return () => removeEventListener('hashchange', sync); }, []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All categories');
  const [sort, setSort] = useState<Sort>('updated');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [boxes, setBoxes] = useState(initialBoxes);
  const memberView = demoRole === 'family-editor' || demoRole === 'family-viewer';
  const canCreate = demoRole === 'personal-owner' || demoRole === 'family-owner';
  const scopedBoxes = memberView ? boxes.filter(box => box.shared) : boxes;
  const scopedSamples = memberView ? samples.filter(row => scopedBoxes.some(box => box.name === row[1])) : samples;
  const [selected, setSelected] = useState<BoxItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftCategory, setDraftCategory] = useState('Other');
  const [toast, setToast] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.documentElement.style.colorScheme = dark ? 'dark' : 'light'; try { localStorage.setItem('boxvault-theme', theme); } catch { /* storage may be unavailable */ } }, [theme, dark]);
  useEffect(() => { const media = matchMedia('(prefers-color-scheme: dark)'); const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches); media.addEventListener('change', listener); return () => media.removeEventListener('change', listener); }, []);
  const go = (next: Page) => { location.hash = '/app/' + Object.keys(routePages).find(key => routePages[key] === next) + '?role=' + demoRole; setPage(next); setSidebarOpen(false); setSelected(null); setPageNumber(1); setQuery(''); };
  const notify = (message: string) => setToast(message);
  const filtered = useMemo(() => {
    let result = scopedBoxes.filter(b => (b.name + ' ' + b.location + ' ' + b.category + ' ' + b.description).toLowerCase().includes(query.toLowerCase()) && (filter === 'All categories' || b.category === filter));
    if (sort === 'name') result = [...result].sort((a,b) => a.name.localeCompare(b.name));
    if (sort === 'items') result = [...result].sort((a,b) => b.items - a.items);
    return result;
  }, [boxes, query, filter, sort, demoRole]);
  const categories = ['All categories', ...new Set(scopedBoxes.map(b => b.category))];
  const totalItems = scopedBoxes.reduce((sum,b) => sum + b.items, 0);
  const createBox = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;
    if (!draftName.trim() || !draftLocation.trim()) return;
    setBoxes(previous => [{ id: Date.now(), name: draftName.trim(), location: draftLocation.trim(), category: draftCategory, items: 0, updated: 'Just now', color: 'sky', icon: '▣', shared: false, description: 'New demo box' }, ...previous]);
    setDraftName(''); setDraftLocation(''); setDraftCategory('Other'); setAddOpen(false); setFilter('All categories'); setSort('updated'); setQuery(''); setPage('My Boxes'); setPageNumber(1);
    notify('Demo box added for this session. No data was sent to a server.');
  };
  const themeSelector = <div className="theme-control" role="group" aria-label="Appearance">
    {(['light','dark','system'] as const).map(option => <button key={option} type="button" className={theme === option ? 'selected' : ''} onClick={() => setTheme(option)} aria-pressed={theme === option} title={option === 'system' ? 'Use device appearance' : option + ' mode'}><Glyph name={option === 'light' ? 'sun' : option === 'dark' ? 'moon' : 'monitor'} size={17}/><span>{option[0].toUpperCase() + option.slice(1)}</span></button>)}
  </div>;
  const boxCard = (box: BoxItem) => <button type="button" key={box.id} className={'box-card ' + (layout === 'list' ? 'box-row' : '')} onClick={() => setSelected(box)}>
    <div className={'box-visual ' + box.color}><span>{box.icon}</span></div>
    <div className="box-info"><div className="box-name">{box.name}</div><div className="muted box-location"><Glyph name="pin" size={14}/>{box.location}</div><div className="box-meta"><span>{box.items} items</span><span aria-hidden="true">·</span><span>{box.updated}</span></div></div>
    <span className={'sharing-dot ' + (box.shared ? 'shared' : '')} title={box.shared ? 'Shared demo box' : 'Private demo box'} aria-label={box.shared ? 'Shared' : 'Private'} />
  </button>;
  const openCreate = () => { if (!canCreate) return; setAddOpen(true); setSidebarOpen(false); };
  return <div className="app-shell">
    <div className="mobile-shade" hidden={!sidebarOpen} onClick={() => setSidebarOpen(false)} />
    <aside className={'sidebar ' + (sidebarOpen ? 'sidebar-open' : '')}>
      <div className="brand"><img src={logo} alt="" /><span>box<span className="brand-blue">vault</span></span><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><Glyph name="close"/></button></div>
      <div className="workspace-switch"><span className="workspace-avatar">H</span><span className="workspace-name"><strong>{demoRole === 'personal-owner' ? 'Personal workspace' : 'Family workspace'}</strong><small>{customerRoleNames[demoRole]} · Demo</small></span><Glyph name="down" size={16}/></div>
      <nav aria-label="Main navigation">{pages.map((item,index) => <div key={item.label}>{(index === 0 || pages[index - 1].group !== item.group) && <div className="nav-caption">{item.group}</div>}<button className={'nav-link ' + (page === item.label ? 'active' : '')} onClick={() => go(item.label)} aria-current={page === item.label ? 'page' : undefined}><span className="nav-symbol" aria-hidden="true">{item.icon}</span>{item.label}{item.label === 'My Boxes' && <span className="nav-count">{scopedBoxes.length}</span>}</button></div>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Glyph name="shield" size={19}/></div><strong>Your space stays yours</strong><p>Boxes are private by default. Sharing is always your choice.</p></div><a href="#/sitemap" className="customer-admin-link"><Glyph name="grid" size={17}/> Explore all roles <Glyph name="arrow" size={15}/></a><a href="#/admin/overview" className="customer-admin-link"><Glyph name="shield" size={17}/> Explore admin preview <Glyph name="arrow" size={15}/></a><div className="user-card"><span className="user-avatar">D</span><span><strong>{customerRoleNames[demoRole]}</strong><small>Frontend preview</small></span><span className="online-dot"/></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="top-left"><button className="icon-button menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Glyph name="menu"/></button><span className="breadcrumbs">Workspace <Glyph name="chevron" size={14}/> <strong>{page}</strong></span></div><div className="top-actions"><div className="top-search"><Glyph name="search" size={17}/><input value={query} onChange={e=>{setQuery(e.target.value);setPageNumber(1);if (page !== 'My Boxes' && page !== 'Inventory') setPage('My Boxes');}} placeholder="Search your boxes..." aria-label="Search boxes"/><kbd>⌘ K</kbd></div><button className="icon-button appearance-shortcut" aria-label="Toggle light or dark mode" title="Toggle appearance" onClick={() => setTheme(dark ? 'light' : 'dark')}><Glyph name={dark ? 'moon' : 'sun'} size={19}/></button><span className="profile-avatar" aria-label="Demo account">D</span></div></header>
      <main className="content">
        <div className="demo-notice"><span className="demo-pulse"/> <strong>Interactive UI preview</strong><span>Sample data only — no backend connection or saved account data</span></div><div className="customer-role-note"><Glyph name="shield" size={14}/>{customerRoleNames[demoRole]}{demoRole === 'family-viewer' ? ' · read-only shared samples' : memberView ? ' · explicitly shared samples' : ' · demo workspace'}</div>
        {page === 'Overview' && <>
          <SectionTitle eyebrow="YOUR WORKSPACE" title="Welcome home 👋" description="A place for everything, and everything easy to find." action={<button className="primary-button" disabled={!canCreate} onClick={openCreate}><Glyph name="plus" size={17}/> Add a box</button>}/>
          <div className="stats-grid"><div className="stat-card"><div className="stat-label"><span>Total boxes</span><span className="stat-icon blue"><Glyph name="box"/></span></div><strong>{scopedBoxes.length}</strong><small>Across your storage spaces</small></div><div className="stat-card"><div className="stat-label"><span>Tracked items</span><span className="stat-icon purple"><Glyph name="list"/></span></div><strong>{totalItems}</strong><small>Ready to find anytime</small></div><div className="stat-card"><div className="stat-label"><span>Storage locations</span><span className="stat-icon green"><Glyph name="pin"/></span></div><strong>{new Set(scopedBoxes.map(b=>b.location.split(' · ')[0])).size}</strong><small>Organized by room or space</small></div><div className="stat-card"><div className="stat-label"><span>Shared boxes</span><span className="stat-icon orange"><Glyph name="users"/></span></div><strong>{scopedBoxes.filter(b=>b.shared).length}</strong><small>Example sharing indicators</small></div></div>
          <div className="dashboard-grid"><section className="panel recent-panel"><div className="panel-header"><div><h2>Recently organized</h2><p>Your boxes at a glance</p></div><button className="text-button" onClick={()=>go('My Boxes')}>View all <Glyph name="arrow" size={16}/></button></div><div className="box-grid compact">{scopedBoxes.slice(0,4).map(boxCard)}</div></section><section className="panel activity-panel"><div className="panel-header"><div><h2>Quick actions</h2><p>Pick up where you left off</p></div></div><div className="quick-actions"><button disabled={!canCreate} onClick={openCreate}><span className="quick-icon"><Glyph name="plus"/></span><span><strong>Create a box</strong><small>Give a storage box a home</small></span><Glyph name="chevron" size={17}/></button><button onClick={()=>go('Inventory')}><span className="quick-icon"><Glyph name="search"/></span><span><strong>Find an item</strong><small>Browse your sample inventory</small></span><Glyph name="chevron" size={17}/></button><button onClick={()=>go('QR Labels')}><span className="quick-icon"><Glyph name="qr"/></span><span><strong>QR labels</strong><small>Preview label management</small></span><Glyph name="chevron" size={17}/></button></div><div className="privacy-tip"><Glyph name="shield" size={19}/><span><strong>Made for your peace of mind</strong><small>Family access will require explicit permission once backend integration is complete.</small></span></div></section></div>
        </>}
        {page === 'My Boxes' && <>
          <SectionTitle eyebrow="YOUR STORAGE" title="My Boxes" description="All your storage, organized in one simple place." action={<button className="primary-button" disabled={!canCreate} onClick={openCreate}><Glyph name="plus" size={17}/> Add a box</button>}/>
          <div className="panel listing-panel"><div className="listing-toolbar"><div className="filter-search"><Glyph name="search" size={17}/><input aria-label="Filter boxes" placeholder="Search boxes or locations" value={query} onChange={e=>{setQuery(e.target.value);setPageNumber(1);}}/></div><div className="filter-right"><label className="select-wrap"><Glyph name="filter" size={16}/><select value={filter} aria-label="Filter by category" onChange={e=>{setFilter(e.target.value);setPageNumber(1);}}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label className="select-wrap"><span>Sort:</span><select value={sort} aria-label="Sort boxes" onChange={e=>setSort(e.target.value as Sort)}><option value="updated">Recent</option><option value="name">Name</option><option value="items">Item count</option></select></label><div className="layout-switch"><button title="Grid view" aria-label="Grid view" aria-pressed={layout==='grid'} className={layout==='grid'?'active':''} onClick={()=>setLayout('grid')}><Glyph name="grid" size={17}/></button><button title="List view" aria-label="List view" aria-pressed={layout==='list'} className={layout==='list'?'active':''} onClick={()=>setLayout('list')}><Glyph name="list" size={17}/></button></div></div></div><div className="listing-count">{filtered.length} {filtered.length === 1 ? 'box' : 'boxes'} found</div>{filtered.length ? <><div className={'box-grid ' + (layout === 'list' ? 'list-mode' : '')}>{filtered.slice((pageNumber-1)*6,pageNumber*6).map(boxCard)}</div><div className="pagination"><span>Showing {Math.min((pageNumber-1)*6+1,filtered.length)}–{Math.min(pageNumber*6,filtered.length)} of {filtered.length}</span><div><button disabled={pageNumber<=1} onClick={()=>setPageNumber(p=>p-1)}>Previous</button><span>Page {pageNumber}</span><button disabled={pageNumber*6>=filtered.length} onClick={()=>setPageNumber(p=>p+1)}>Next</button></div></div></> : <div className="empty-state"><span>⌕</span><h3>No boxes found</h3><p>Try another search or filter, or create a new demo box.</p><button className="secondary-button" onClick={()=>{setQuery('');setFilter('All categories');}}>Clear filters</button></div>}</div>
        </>}
        {page === 'Inventory' && <>
          <SectionTitle eyebrow="FIND WHAT YOU NEED" title="Inventory" description="Search through the items in your sample boxes."/>
          <div className="panel listing-panel"><div className="listing-toolbar"><div className="filter-search"><Glyph name="search" size={17}/><input placeholder="Search item or container..." aria-label="Search inventory" value={query} onChange={e=>setQuery(e.target.value)}/></div></div><div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Item</th><th>Box</th><th>Category</th><th>Qty.</th></tr></thead><tbody>{scopedSamples.filter(row=>row.join(' ').toLowerCase().includes(query.toLowerCase())).map((row,i)=><tr key={i}><td><span className="item-icon">▣</span><strong>{row[0]}</strong></td><td>{row[1]}</td><td><span className="category-pill">{row[2]}</span></td><td>{row[3]}</td></tr>)}</tbody></table>{!scopedSamples.some(row=>row.join(' ').toLowerCase().includes(query.toLowerCase())) && <div className="empty-state">No matching demo items.</div>}</div></div>
        </>}
        {page === 'Locations' && <><SectionTitle eyebrow="KNOW WHERE IT IS" title="Locations" description="Browse your boxes by room and storage space."/><div className="location-grid">{[...new Set(scopedBoxes.map(b=>b.location.split(' · ')[0]))].map(place=><button className="location-card" key={place} onClick={()=>{setPage('My Boxes');setQuery(place);setFilter('All categories');}}><span className="location-icon"><Glyph name="pin" size={22}/></span><div><strong>{place}</strong><small>{scopedBoxes.filter(b=>b.location.startsWith(place)).length} boxes</small></div><Glyph name="chevron" size={18}/></button>)}</div></>}
        {page === 'QR Labels' && <><SectionTitle eyebrow="SCAN & FIND" title="QR Labels" description="Manage the labels that help you find your stored belongings."/><div className="panel placeholder-panel"><div className="placeholder-icon"><Glyph name="qr" size={38}/></div><h2>Labels without the guesswork</h2><p>Each box will get a secure, opaque QR code once label generation is connected. For now, browse the sample containers and preview the label workflow.</p><button className="primary-button" onClick={()=>go('My Boxes')}>Browse my boxes <Glyph name="arrow" size={17}/></button><small>Preview only — no working QR codes or scan permissions are issued here.</small></div></>}
        {page === 'Family' && <><SectionTitle eyebrow="SHARE ON YOUR TERMS" title="Family" description="Control exactly who can access each shared box."/><div className="panel family-panel"><div className="family-heading"><div className="large-icon"><Glyph name="users" size={27}/></div><div><h2>Family workspace</h2><p>Private by default. Only invited members with explicitly granted access will see shared containers.</p></div></div><div className="member-list"><div><span className="user-avatar">Y</span><span><strong>You ({customerRoleNames[demoRole].toLowerCase()})</strong><small>{customerRoleNames[demoRole]}</small></span><span className="category-pill">{demoRole === 'family-viewer' ? 'Viewer' : demoRole === 'family-editor' ? 'Editor' : 'Owner'}</span></div><div><span className="user-avatar soft">F</span><span><strong>Family member example</strong><small>Sample only, not a real invitation</small></span><span className="category-pill">Viewer</span></div></div><button className="secondary-button" disabled={demoRole !== 'family-owner'} onClick={()=>notify('Invitations are a UI placeholder; no email was sent.')}>+ Invite a member (preview)</button></div></>}
        {page === 'Plans & Credits' && <><SectionTitle eyebrow="YOUR MEMBERSHIP" title="Plans & Credits" description="Free, monthly and annual plans for the way you organize."/><PlanPreview onPreview={plan => notify(plan + ' preview only. No plan, payment or advertisement was activated.')}/></>}
        {page === 'Settings' && <><SectionTitle eyebrow="MAKE IT YOURS" title="Settings" description="Adjust your BoxVault browsing experience."/><div className="panel settings-panel"><div><h2>Appearance</h2><p>Choose a theme or match your device automatically. This choice is saved in this browser.</p></div>{themeSelector}<div className="appearance-preview"><div className="preview-dot"/><div><strong>{dark ? 'Dark' : 'Light'} appearance active</strong><small>{theme === 'system' ? 'Following your device setting' : 'Manual appearance preference'}</small></div></div><hr/><div><h2>About this preview</h2><p>Only the appearance preference is saved locally. Sample boxes added during this session will reset when you refresh. This is not a signed-in account.</p></div></div></>}
        <footer className="footer"><span>© BoxVault · Frontend prototype</span><a href="#/" className="text-button">Back to website</a></footer>
      </main>
    </div>
    {selected && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}><div className="detail-modal" role="dialog" aria-modal="true" aria-label={selected.name}><div className="modal-header"><span className="eyebrow">BOX DETAILS · DEMO</span><button className="icon-button" aria-label="Close details" onClick={()=>setSelected(null)}><Glyph name="close"/></button></div><div className={'detail-visual ' + selected.color}>{selected.icon}</div><h2>{selected.name}</h2><p>{selected.description}</p><div className="detail-data"><div><small>LOCATION</small><strong>{selected.location}</strong></div><div><small>ITEMS</small><strong>{selected.items}</strong></div><div><small>ACCESS</small><strong>{selected.shared ? 'Shared example' : 'Private'}</strong></div></div><button className="secondary-button full-width" onClick={()=>{setSelected(null);go('QR Labels');}}>Explore QR labels <Glyph name="arrow" size={17}/></button></div></div>}
    {addOpen && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setAddOpen(false);}}><form className="create-modal" role="dialog" aria-modal="true" aria-label="Add demo box" onSubmit={createBox}><div className="modal-header"><div><span className="eyebrow">ORGANIZE SOMETHING</span><h2>Add a box</h2></div><button type="button" className="icon-button" onClick={()=>setAddOpen(false)} aria-label="Close form"><Glyph name="close"/></button></div><p>Create a sample box to try the interface. Nothing will be saved to a server.</p><label>Box name <input required maxLength={80} autoFocus placeholder="e.g. Birthday decorations" value={draftName} onChange={e=>setDraftName(e.target.value)}/></label><label>Location <input required maxLength={100} placeholder="e.g. Bedroom · Upper Shelf" value={draftLocation} onChange={e=>setDraftLocation(e.target.value)}/></label><label>Category <select value={draftCategory} onChange={e=>setDraftCategory(e.target.value)}>{['Other','Seasonal','Outdoor','Keepsakes','Kitchen','Clothing','Tools'].map(c=><option key={c}>{c}</option>)}</select></label><div className="form-actions"><button type="button" className="secondary-button" onClick={()=>setAddOpen(false)}>Cancel</button><button type="submit" className="primary-button"><Glyph name="plus" size={17}/> Add demo box</button></div></form></div>}
    {toast && <div className="toast-message" role="status"><Glyph name="check" size={18}/><span>{toast}</span><button aria-label="Dismiss notification" onClick={()=>setToast('')}><Glyph name="close" size={16}/></button></div>}
  </div>;
}
