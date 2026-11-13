import { qrcodegen } from './vendor/qrcodegen.js';

export type ErrorCorrection = 'L' | 'M' | 'Q' | 'H';
export type SegmentInput =
  | { mode: 'numeric' | 'alphanumeric' | 'bytes'; value: string }
  | { mode: 'eci'; assignment: number };
export type QrOptions = Readonly<{
  value: string;
  errorCorrection?: ErrorCorrection;
  minVersion?: number;
  maxVersion?: number;
  mask?: number;
  boostEcl?: boolean;
  quietZone?: number;
  segments?: readonly SegmentInput[];
}>;
export type QrMatrix = Readonly<{
  size: number;
  version: number;
  mask: number;
  errorCorrection: ErrorCorrection;
  quietZone: number;
  getModule(x: number, y: number): boolean;
}>;
export type SvgOptions = Readonly<{
  dark?: string;
  light?: string;
  scale?: number;
}>;
const ecl: Record<ErrorCorrection, qrcodegen.QrCode.Ecc> = {
  L: qrcodegen.QrCode.Ecc.LOW,
  M: qrcodegen.QrCode.Ecc.MEDIUM,
  Q: qrcodegen.QrCode.Ecc.QUARTILE,
  H: qrcodegen.QrCode.Ecc.HIGH,
};
const validInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
function assertColors(dark: string, light: string): void {
  if (!/^#[0-9a-fA-F]{6}$/.test(dark) || !/^#[0-9a-fA-F]{6}$/.test(light))
    throw new RangeError('Colors must be six-digit opaque hex values');
  if (dark.toLowerCase() === light.toLowerCase()) throw new RangeError('QR foreground and background must differ');
}
function makeSegments(input: readonly SegmentInput[]): qrcodegen.QrSegment[] {
  if (input.length > 100) throw new RangeError('Too many segments');
  return input.map(segment => {
    switch (segment.mode) {
      case 'numeric': return qrcodegen.QrSegment.makeNumeric(segment.value);
      case 'alphanumeric': return qrcodegen.QrSegment.makeAlphanumeric(segment.value);
      case 'bytes': return qrcodegen.QrSegment.makeBytes(Array.from(new TextEncoder().encode(segment.value)));
      case 'eci':
        if (!validInt(segment.assignment, 0, 999999)) throw new RangeError('Invalid ECI assignment');
        return qrcodegen.QrSegment.makeEci(segment.assignment);
    }
  });
}
export function encodeQr(options: QrOptions): QrMatrix {
  if (typeof options.value !== 'string' || (options.value.length === 0 && !options.segments?.length))
    throw new RangeError('Text must not be empty');
  if (new TextEncoder().encode(options.value).length > 2953) throw new RangeError('Payload exceeds maximum QR byte capacity');
  const min = options.minVersion ?? 1, max = options.maxVersion ?? 40, mask = options.mask ?? -1;
  const quietZone = options.quietZone ?? 4, correction = options.errorCorrection ?? 'M';
  if (!validInt(min, 1, 40) || !validInt(max, min, 40)) throw new RangeError('Invalid QR version range');
  if (!validInt(mask, -1, 7)) throw new RangeError('Mask must be -1 (auto) or 0–7');
  if (!validInt(quietZone, 4, 32)) throw new RangeError('Quiet zone must be 4–32 modules');
  if (!(correction in ecl)) throw new RangeError('Invalid error correction level');
  if (options.boostEcl !== undefined && typeof options.boostEcl !== 'boolean') throw new RangeError('Invalid boost ECC flag');
  const segments = options.segments ? makeSegments(options.segments) : qrcodegen.QrSegment.makeSegments(options.value);
  const code = qrcodegen.QrCode.encodeSegments(segments, ecl[correction], min, max, mask, options.boostEcl ?? true);
  const actualEcl = (Object.keys(ecl) as ErrorCorrection[]).find(level => ecl[level] === code.errorCorrectionLevel)!;
  return Object.freeze({
    size: code.size,
    version: code.version,
    mask: code.mask,
    errorCorrection: actualEcl,
    quietZone,
    getModule(x: number, y: number): boolean {
      if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
      return code.getModule(x, y);
    },
  });
}
export function renderQrSvg(matrix: QrMatrix, options: SvgOptions = {}): string {
  const dark = options.dark ?? '#142c3c', light = options.light ?? '#ffffff', scale = options.scale ?? 8;
  assertColors(dark, light);
  if (!validInt(scale, 1, 64)) throw new RangeError('SVG scale must be 1–64');
  if (!validInt(matrix.size, 21, 177) || !validInt(matrix.quietZone, 4, 32)) throw new RangeError('Invalid matrix');
  const side = matrix.size + 2 * matrix.quietZone;
  const path: string[] = [];
  for (let y = 0; y < matrix.size; y++)
    for (let x = 0; x < matrix.size; x++)
      if (matrix.getModule(x, y)) path.push('M' + (x + matrix.quietZone) + ',' + (y + matrix.quietZone) + 'h1v1h-1z');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + (side * scale) + '" height="' + (side * scale) +
    '" viewBox="0 0 ' + side + ' ' + side + '" shape-rendering="crispEdges" role="img" aria-label="QR code">' +
    '<rect width="100%" height="100%" fill="' + light + '"/><path fill="' + dark + '" d="' + path.join('') + '"/></svg>';
}
export function getQrStatistics(matrix: QrMatrix): { version: number; size: number; mask: number; errorCorrection: ErrorCorrection; totalModules: number; darkModules: number; imageModules: number } {
  let darkModules = 0;
  for (let y = 0; y < matrix.size; y++) for (let x = 0; x < matrix.size; x++) if (matrix.getModule(x, y)) darkModules++;
  return { version: matrix.version, size: matrix.size, mask: matrix.mask, errorCorrection: matrix.errorCorrection, totalModules: matrix.size ** 2, darkModules, imageModules: (matrix.size + matrix.quietZone * 2) ** 2 };
}
