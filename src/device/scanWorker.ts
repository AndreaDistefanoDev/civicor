// Worker di decodifica: il file .wasm viene servito dall'app stessa (funziona anche offline).
import { prepareZXingModule } from 'zxing-wasm/reader';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { decodeDataMatrix } from './zxing';

prepareZXingModule({
  overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
});

self.onmessage = async (e: MessageEvent<{ id: number; img: ImageData }>) => {
  const text = await decodeDataMatrix(e.data.img).catch(() => null);
  self.postMessage({ id: e.data.id, text });
};
