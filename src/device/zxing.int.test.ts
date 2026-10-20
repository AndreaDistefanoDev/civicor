// @vitest-environment node
import { readFileSync } from 'node:fs';
import { prepareZXingModule as prepareReader } from 'zxing-wasm/reader';
import { prepareZXingModule as prepareWriter, writeBarcode } from 'zxing-wasm/writer';
import { buildGlsPayload } from '../domain/gls/testPayload';
import { parseGlsDataMatrix } from '../domain/gls/parseGlsDataMatrix';
import { decodeDataMatrix } from './zxing';

// ImageData minimo per Node (nel browser esiste già).
class NodeImageData {
  constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
}

beforeAll(() => {
  (globalThis as Record<string, unknown>).ImageData ??= NodeImageData;
  const bin = (p: string) => readFileSync(new URL(`../../node_modules/zxing-wasm/dist/${p}`, import.meta.url)).buffer as ArrayBuffer;
  prepareReader({ overrides: { wasmBinary: bin('reader/zxing_reader.wasm') } });
  prepareWriter({ overrides: { wasmBinary: bin('writer/zxing_writer.wasm') } });
});

/** Simbolo a un canale → immagine RGBA ingrandita con margine bianco, come una foto nitida. */
function toImageData(symbol: { data: Uint8ClampedArray; width: number; height: number }, scale = 6, quiet = 4): ImageData {
  const w = (symbol.width + quiet * 2) * scale;
  const h = (symbol.height + quiet * 2) * scale;
  const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 0; y < symbol.height; y++) {
    for (let x = 0; x < symbol.width; x++) {
      const v = symbol.data[y * symbol.width + x];
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = ((y + quiet) * scale + dy) * w + (x + quiet) * scale + dx;
          rgba[px * 4] = rgba[px * 4 + 1] = rgba[px * 4 + 2] = v;
        }
      }
    }
  }
  return new ImageData(rgba, w, h);
}

it('legge un Data Matrix GLS generato con dati inventati', async () => {
  const payload = buildGlsPayload({
    trackingNumber: 'ZZ123456789010RG', recipient: 'mario rossi', street: 'Via Esempio, 12',
    city: 'ragusa', notes: 'CHIAMARE PRIMA', postcode: '97100', province: 'RG',
  });
  const written = await writeBarcode(payload, { format: 'DataMatrix' });
  expect(written.error).toBe('');
  const text = await decodeDataMatrix(toImageData(written.symbol));
  expect(text).toBe(payload);
  expect(parseGlsDataMatrix(text!)?.street).toBe('Via Esempio, 12');
});

it('immagine senza codici → null', async () => {
  const blank = new ImageData(new Uint8ClampedArray(100 * 100 * 4).fill(255), 100, 100);
  expect(await decodeDataMatrix(blank)).toBeNull();
});
