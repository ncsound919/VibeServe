import { logger } from '../../lib/logger';

const CTX = 'LocalEmbeddings';

let pipelinePromise: Promise<any> | null = null;

async function getPipeline() {
  if (pipelinePromise) return pipelinePromise;

  pipelinePromise = (async () => {
    const { pipeline } = await import('@xenova/transformers');
    logger.info(CTX, 'Loading local embeddings model (all-MiniLM-L6-v2)...');
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true,
    });
    logger.info(CTX, 'Local embeddings model loaded');
    return extractor;
  })();

  return pipelinePromise;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const extractor = await getPipeline();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array) as number[];
  } catch (err) {
    logger.warn(CTX, 'Local embeddings failed, using hash fallback', err);
    return fallbackEmbedding(text);
  }
}

function fallbackEmbedding(text: string): number[] {
  const vec = new Array(384).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % 384] += ((text.charCodeAt(i) * (i + 1)) / 100000) % 2 - 1;
  }
  const magnitude = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= magnitude;
  }
  return vec;
}
