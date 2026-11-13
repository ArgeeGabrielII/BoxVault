import { useMemo, useState } from 'react';
import { encodeQr, getQrStatistics, renderQrSvg, type ErrorCorrection, type SegmentInput, type QrMatrix } from '../../../../packages/qr/src/index';
import { renderQrPngBrowser } from '../../../../packages/qr/src/browser';
import { renderLabelSvg } from '../../../../packages/qr/src/labels';

type Output = 'svg' | 'png';
type UiMode = 'standard' | 'segments';
const initial = 'https://example.com/c/DEMO-NOT-A-REAL-TOKEN';
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function App() {
  const [text,setText] = useState(initial);
  const [ecc,setEcc] = useState<ErrorCorrection>('M');
  const [output,setOutput] = useState<Output>('svg');
  const [border,setBorder] = useState(4);
  const [scale,setScale] = useState(8);
  const [light,setLight] = useState('#ffffff');
  const [dark,setDark] = useState('#142c3c');
  const [min,setMin] = useState(1);
  const [max,setMax] = useState(40);
  const [mask,setMask] = useState(-1);
  const [boost,setBoost] = useState(true);
  const [mode,setMode] = useState<UiMode>('standard');
  const [segMode,setSegMode] = useState<'numeric'|'alphanumeric'|'bytes'>('bytes');
  const [eci,setEci] = useState(false);
  const [labelTitle,setLabelTitle] = useState('My storage box');
  const [labelSub,setLabelSub] = useState('QR label design preview');
  const [tab,setTab] = useState<'symbol'|'label'>('symbol');
  const [theme,setTheme] = useState<'light'|'dark'>('light');
  const parsed = useMemo((): {matrix?: QrMatrix; svg?: string; error?: string} => {
    try {
      const segments: SegmentInput[] | undefined = mode==='segments'
        ? [...(eci ? [{mode:'eci',assignment:26} as const] : []),{mode:segMode,value:text}]
        : undefined;
      const matrix = encodeQr({value:text,errorCorrection:ecc,quietZone:border,minVersion:min,maxVersion:max,mask,boostEcl:boost,segments});
      return {matrix,svg:renderQrSvg(matrix,{dark,light,scale})};
    } catch(error) {
      return {error:error instanceof Error ? error.message : 'Unable to encode QR'};
    }
  },[text,ecc,border,min,max,mask,boost,mode,segMode,eci,dark,light,scale]);
  const stats = parsed.matrix ? getQrStatistics(parsed.matrix) : null;
  const svg = parsed.matrix ? (tab==='label' ? renderLabelSvg({title:labelTitle,subtitle:labelSub,reference:'DEMO · NOT FOR PRODUCTION',matrix:parsed.matrix}) : parsed.svg!) : '';
  const download = async () => {
    if (!parsed.matrix) return;
    try {
      if (output==='svg' || tab==='label') saveBlob(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),tab==='label'?'boxvault-demo-label.svg':'boxvault-demo-qr.svg');
      else saveBlob(await renderQrPngBrowser(parsed.matrix,{pixels:(parsed.matrix.size+border*2)*scale,dark,light}),'boxvault-demo-qr.png');
    } catch(e) { window.alert(e instanceof Error ? e.message : 'Export failed'); }
  };
  const symbolColor = {dark,light};
  return <div className="lab" data-theme={theme}>
    <header className="header"><div className="header-inner"><div className="brand"><div className="brand-icon">▦</div><div><strong>BoxVault <span>QR Lab</span></strong><small>Developer playground</small></div></div><div className="header-right"><span className="demo-pill">MOCK ONLY · NOT PRODUCTION</span><button className="theme-button" onClick={()=>setTheme(theme==='light'?'dark':'light')}>{theme==='light'?'☾ Dark':'☀ Light'}</button></div></div></header>
    <main className="page">
      <div className="intro"><div><div className="kicker">TOOLS / QR CODE GENERATOR</div><h1>Make every scan count.</h1><p>Explore the same encoding controls as Nayuki's QR demo, with BoxVault-owned rendering. Local, fictional data only.</p></div><a href="https://www.nayuki.io/page/qr-code-generator-library" target="_blank" rel="noreferrer">Nayuki reference ↗</a></div>
      <div className="notice"><strong>Safe sandbox:</strong> No backend, accounts or production tokens. QR generation runs locally in your browser. The real BoxVault app will issue and render secure QR labels server-side.</div>
      <div className="workspace">
        <section className="controls card">
          <div className="card-head"><div><h2>QR configuration</h2><p>Update settings to regenerate the preview.</p></div><span className="mini-badge">Live</span></div>
          <div className="field"><label htmlFor="payload">Text or URL to encode</label><textarea id="payload" value={text} onChange={e=>setText(e.target.value)} rows={3} maxLength={4000} spellCheck={false}/><div className="field-tip">{new TextEncoder().encode(text).length} UTF-8 bytes · use demo data only</div></div>
          <div className="two-col"><div className="field"><label htmlFor="ecc">Error correction</label><select id="ecc" value={ecc} onChange={e=>setEcc(e.target.value as ErrorCorrection)}><option value="L">Low (L)</option><option value="M">Medium (M)</option><option value="Q">Quartile (Q)</option><option value="H">High (H)</option></select></div><div className="field"><label htmlFor="format">Output format</label><select id="format" value={output} onChange={e=>setOutput(e.target.value as Output)}><option value="svg">SVG vector</option><option value="png">PNG bitmap</option></select></div></div>
          <div className="two-col"><div className="field"><label htmlFor="border">Border (modules)</label><input id="border" type="number" min={4} max={32} value={border} onChange={e=>setBorder(Number(e.target.value))}/></div><div className="field"><label htmlFor="scale">Scale (pixels per module)</label><input id="scale" type="number" min={1} max={64} value={scale} onChange={e=>setScale(Number(e.target.value))}/></div></div>
          <div className="colors"><div className="field"><label htmlFor="light">Light modules</label><div className="color-input"><input id="light" type="color" value={light} onChange={e=>setLight(e.target.value)}/><span>{light.toUpperCase()}</span></div></div><div className="field"><label htmlFor="dark">Dark modules</label><div className="color-input"><input id="dark" type="color" value={dark} onChange={e=>setDark(e.target.value)}/><span>{dark.toUpperCase()}</span></div></div></div>
          <details className="advanced" open><summary>Advanced encoding options <span>⌄</span></summary>
            <div className="two-col"><div className="field"><label htmlFor="vmin">Min version (1–40)</label><input id="vmin" type="number" min={1} max={40} value={min} onChange={e=>setMin(Number(e.target.value))}/></div><div className="field"><label htmlFor="vmax">Max version (1–40)</label><input id="vmax" type="number" min={1} max={40} value={max} onChange={e=>setMax(Number(e.target.value))}/></div></div>
            <div className="field"><label htmlFor="mask">Mask pattern</label><select id="mask" value={mask} onChange={e=>setMask(Number(e.target.value))}><option value={-1}>Automatic (recommended)</option>{Array.from({length:8},(_,i)=><option value={i} key={i}>Mask {i}</option>)}</select></div>
            <label className="checkbox"><input type="checkbox" checked={boost} onChange={e=>setBoost(e.target.checked)}/><span>Boost error correction if it fits the same version</span></label>
            <div className="field"><label htmlFor="segmentmode">Encoding mode</label><select id="segmentmode" value={mode} onChange={e=>setMode(e.target.value as UiMode)}><option value="standard">Automatic segments (Nayuki default)</option><option value="segments">Manual single segment</option></select></div>
            {mode==='segments' && <><div className="field"><label htmlFor="segmenttype">Segment type</label><select id="segmenttype" value={segMode} onChange={e=>setSegMode(e.target.value as typeof segMode)}><option value="numeric">Numeric</option><option value="alphanumeric">Alphanumeric</option><option value="bytes">UTF-8 bytes</option></select></div><label className="checkbox"><input type="checkbox" checked={eci} onChange={e=>setEci(e.target.checked)}/><span>Prepend UTF-8 ECI 26 (manual segment)</span></label></>}
          </details>
        </section>
        <section className="preview-column">
          <div className="card preview-card"><div className="card-head"><div><h2>Live preview</h2><p>Standards-based QR Code Model 2</p></div><span className="ready">{parsed.error?'Needs attention':'● Generated'}</span></div>
            <div className="tabs" role="tablist"><button role="tab" aria-selected={tab==='symbol'} className={tab==='symbol'?'on':''} onClick={()=>setTab('symbol')}>QR symbol</button><button role="tab" aria-selected={tab==='label'} className={tab==='label'?'on':''} onClick={()=>setTab('label')}>Storage label</button></div>
            {tab==='label' && <div className="label-fields"><input aria-label="Label title" placeholder="Label title" maxLength={60} value={labelTitle} onChange={e=>setLabelTitle(e.target.value)}/><input aria-label="Label subtitle" placeholder="Label subtitle" maxLength={80} value={labelSub} onChange={e=>setLabelSub(e.target.value)}/></div>}
            <div className={'preview-stage '+(tab==='label'?'label-stage':'')}>{parsed.error?<div className="error" role="alert"><strong>Unable to render QR</strong><span>{parsed.error}</span></div>:<img src={'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)} alt={tab==='label'?'Printable QR label demo':'Generated QR preview (mock payload)'}/>}</div>
            <div className="preview-actions"><button className="primary" onClick={download} disabled={!parsed.matrix}>↓ Download {tab==='label'?'Label SVG':output.toUpperCase()}</button><button className="outline" disabled={!parsed.matrix} onClick={()=>{if(svg) void navigator.clipboard.writeText(svg);}}>Copy SVG</button></div>
            <p className="preview-warning">Do not scan this demo URL expecting a real BoxVault container. Production generation will run on authorized backend services.</p>
          </div>
          <div className="card stats"><h2>Symbol statistics</h2>{stats?<div className="stats-grid"><div><span>Version</span><strong>{stats.version} / 40</strong></div><div><span>Matrix</span><strong>{stats.size} × {stats.size}</strong></div><div><span>Selected mask</span><strong>{stats.mask}</strong></div><div><span>Actual ECC</span><strong>{stats.errorCorrection}</strong></div><div><span>Dark modules</span><strong>{stats.darkModules.toLocaleString()}</strong></div><div><span>Quiet zone</span><strong>{border} modules</strong></div></div>:<p>Adjust the invalid settings to see statistics.</p>}</div>
          <div className="card guidance"><h2>What this lab does not do</h2><p>It does not create secure QR tokens, resolve private boxes, send URLs to a backend, serve Google ads, or grant access. Mock labels are not production artifacts.</p><div className="sample-palette"><span>Preview colors</span><span style={{background:symbolColor.light,color:symbolColor.dark,border:'1px solid #cbd5e1',padding:'6px 10px',borderRadius:6}}>▦ □ ■</span></div></div>
        </section>
      </div>
      <footer>BoxVault QR Lab · Browser-only developer tool · QR algorithm © Project Nayuki (MIT) · <a href="/licenses.txt">Open-source notices</a></footer>
    </main>
  </div>;
}
