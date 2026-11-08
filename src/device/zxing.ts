import { readBarcodes } from 'zxing-wasm/reader';
import { bestCode } from '../domain/label/codes';

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

/**
 * Legge tutti i codici dell'etichetta (Data Matrix, QR, codici a barre) e restituisce il più utile:
 * prima il Data Matrix GLS, poi un quadratino con l'indirizzo, poi il numero di spedizione.
 */
export async function decodeLabelCodes(img: ImageData): Promise<string | null> {
  const results = await readBarcodes(img, {
    formats: ['DataMatrix', 'QRCode', 'Code128', 'Code39'],
    maxNumberOfSymbols: 4,
    tryHarder: true,
  });
  return bestCode(results.filter((r) => r.isValid && r.text).map((r) => r.text));
}
