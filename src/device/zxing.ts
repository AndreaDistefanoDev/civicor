import { readBarcodes } from 'zxing-wasm/reader';

/** Legge un codice Data Matrix da un fotogramma. null se non c'è o non è leggibile. */
export async function decodeDataMatrix(img: ImageData): Promise<string | null> {
  const results = await readBarcodes(img, {
    formats: ['DataMatrix'],
    maxNumberOfSymbols: 1,
    tryHarder: true,
  });
  const hit = results.find((r) => r.isValid && r.text);
  return hit ? hit.text : null;
}
