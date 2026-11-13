import type { QrMatrix } from './index.js';
import { renderQrSvg } from './index.js';
export type Label = Readonly<{ title: string; subtitle?: string; reference?: string; matrix: QrMatrix }>;
const escapeXml = (s: string) => s.replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;' })[c]!);
export function renderLabelSvg(label: Label): string {
  const safeTitle = escapeXml(label.title.slice(0,60));
  const safeSub = escapeXml((label.subtitle ?? '').slice(0,80));
  const safeRef = escapeXml((label.reference ?? '').slice(0,60));
  // Fixed vector layout for mock preview; physical print sizes need device-specific validation.
  const qr = renderQrSvg(label.matrix, { dark:'#142c3c',light:'#ffffff',scale:4 });
  const svgBody = qr.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
  const totalModules = label.matrix.size + label.matrix.quietZone * 2;
  const side = Math.min(212, totalModules * 4);
  return '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="270" viewBox="0 0 560 270">' +
   '<rect width="560" height="270" fill="#ffffff" stroke="#d6dfea"/>' +
   '<svg x="14" y="'+Math.floor((270-side)/2)+'" width="'+side+'" height="'+side+'" viewBox="0 0 '+totalModules+' '+totalModules+'">'+svgBody+'</svg>'+
   '<g fill="#142c3c" font-family="Arial,sans-serif"><text x="'+(side+30)+'" y="74" font-size="16" font-weight="bold">BOXVAULT</text>'+
   '<text x="'+(side+30)+'" y="116" font-size="15">'+safeTitle+'</text><text x="'+(side+30)+'" y="146" font-size="12">'+safeSub+'</text>'+
   '<text x="'+(side+30)+'" y="186" font-size="11">'+safeRef+'</text></g></svg>';
}
