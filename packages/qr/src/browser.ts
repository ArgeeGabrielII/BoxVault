import type { QrMatrix } from './index.js';
export type PngOptions = Readonly<{ pixels: number; dark?: string; light?: string }>;
export async function renderQrPngBrowser(matrix: QrMatrix, options: PngOptions): Promise<Blob> {
  const dark = options.dark ?? '#142c3c', light = options.light ?? '#ffffff';
  if (!/^#[a-f\d]{6}$/i.test(dark) || !/^#[a-f\d]{6}$/i.test(light) || dark.toLowerCase() === light.toLowerCase()) throw new RangeError('Invalid colors');
  const total = matrix.size + matrix.quietZone * 2;
  if (!Number.isInteger(options.pixels) || options.pixels < total || options.pixels > 4096) throw new RangeError('Invalid pixel size');
  const modulePixels = Math.floor(options.pixels / total);
  const pixels = modulePixels * total; // integer pixel modules, no antialiasing
  const canvas = document.createElement('canvas');
  canvas.width = pixels; canvas.height = pixels;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.fillStyle = light; context.fillRect(0, 0, pixels, pixels);
  context.fillStyle = dark;
  for (let y=0; y<matrix.size; y++) for (let x=0; x<matrix.size; x++)
    if (matrix.getModule(x,y)) context.fillRect((x+matrix.quietZone)*modulePixels,(y+matrix.quietZone)*modulePixels,modulePixels,modulePixels);
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob ? resolve(blob) : reject(new Error('PNG export failed')),'image/png'));
}
