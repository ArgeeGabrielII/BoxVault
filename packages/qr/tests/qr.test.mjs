import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeQr, renderQrSvg, getQrStatistics } from '../dist/index.js';
import { renderLabelSvg } from '../dist/labels.js';

test('encodes a standard URL and creates a safe, deterministic SVG', () => {
  const qr = encodeQr({value:'https://example.com/c/DEMO',boostEcl:false});
  assert.ok(qr.size >= 21);
  assert.equal(qr.version * 4 + 17,qr.size);
  assert.equal(qr.errorCorrection,'M');
  const svg = renderQrSvg(qr);
  assert.ok(svg.startsWith('<svg '));
  assert.match(svg,/shape-rendering="crispEdges"/);
  assert.match(svg,/viewBox="0 0 /);
  assert.equal(svg,renderQrSvg(qr));
  assert.ok(getQrStatistics(qr).darkModules > 0);
});
test('supports all ECC levels, manual masks and QR versions', () => {
  for (const ecc of ['L','M','Q','H']) {
    const qr=encodeQr({value:'BOXVAULT',errorCorrection:ecc,minVersion:3,maxVersion:3,mask:7,boostEcl:false});
    assert.equal(qr.version,3);
    assert.equal(qr.mask,7);
    assert.equal(qr.errorCorrection,ecc);
  }
});
test('supports automatic and manual byte/numeric/alphanumeric segments with ECI', () => {
  assert.equal(encodeQr({value:'123456789'}).size,21);
  assert.ok(encodeQr({value:'Hello 世界',segments:[{mode:'eci',assignment:26},{mode:'bytes',value:'Hello 世界'}]}).size>=21);
  assert.ok(encodeQr({value:'HELLO 123',segments:[{mode:'alphanumeric',value:'HELLO 123'}]}).size>=21);
});
test('guards against unsafe or nonsensical parameters', () => {
  for (const values of [
    {value:''},
    {value:'x',minVersion:0},
    {value:'x',minVersion:40,maxVersion:1},
    {value:'x',mask:8},
    {value:'x',quietZone:3},
    {value:'x',segments:[{mode:'eci',assignment:-1}]}
  ]) assert.throws(()=>encodeQr(values));
  const matrix=encodeQr({value:'safe'});
  assert.throws(()=>renderQrSvg(matrix,{dark:'url(javascript:evil)',light:'#ffffff'}));
  assert.throws(()=>renderQrSvg(matrix,{dark:'#ffffff',light:'#ffffff'}));
  assert.throws(()=>renderQrSvg(matrix,{scale:1000}));
});
test('escapes attacker-controlled label fields; QR remains independent of labels', () => {
  const matrix=encodeQr({value:'demo'});
  for (const tag of ['script', 'SCRIPT', 'ScRiPt']) {
    const payload='<'+tag+'>alert("x")</'+tag+'>';
    const label=renderLabelSvg({matrix,title:payload,subtitle:payload,reference:payload});
    // This checks generated output; it is never used as an HTML sanitizer.
    assert.doesNotMatch(label,/<script\b/i);
    assert.equal(label.split('&lt;'+tag+'&gt;').length-1,3,
      'Every user-controlled text field must escape tag delimiters');
  }
  const label=renderLabelSvg({matrix,title:'<img src=x onerror="x">',subtitle:'a & b',reference:'"quoted"'});
  assert.doesNotMatch(label,/<img\b/i);
  assert.match(label,/&lt;img src=x onerror=&quot;x&quot;&gt;/);
  assert.match(label,/a &amp; b/);
  assert.match(label,/&quot;quoted&quot;/);
});
