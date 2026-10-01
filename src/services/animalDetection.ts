import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';

export interface DetectedEntity {
  id: string;
  class: string;
  displayName: string;
  isAnimal: boolean;
  score: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
}

const ANIMAL_CLASSES: Record<string, string> = {
  dog: 'Canine (Dog)',
  cat: 'Feline (Cat)',
  bird: 'Avian (Bird)',
  horse: 'Equine (Horse)',
  sheep: 'Ovine (Sheep)',
  cow: 'Bovine (Cow)',
  elephant: 'Elephant',
  bear: 'Ursine (Bear)',
  zebra: 'Zebra',
  giraffe: 'Giraffe'
};

let cocoModel: cocoSsd.ObjectDetection | null = null;
let isLoading = false;
let loadPromise: Promise<cocoSsd.ObjectDetection> | null = null;

export async function loadAnimalDetector(): Promise<cocoSsd.ObjectDetection> {
  if (cocoModel) return cocoModel;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    isLoading = true;
    try {
      // Ensure tf backend is ready
      if (tf) {
        try {
          if (tf.getBackend() !== 'webgl') {
            await tf.setBackend('webgl');
          }
        } catch {
          // fall back
        }
      }

      // lite_mobilenet_v2 offers high-speed sub-15ms real-time inference
      const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      cocoModel = model;
      console.log('[Lookout AI] COCO Animal & Entity Neural Detector initialized.');
      return model;
    } catch (err) {
      console.error('[Lookout AI] Failed to load animal detector:', err);
      loadPromise = null;
      throw err;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

export function isAnimalDetectorLoaded(): boolean {
  return cocoModel !== null;
}

export async function detectAnimalsAndEntities(
  imageSource: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  minScore = 0.40
): Promise<DetectedEntity[]> {
  if (!cocoModel) return [];

  try {
    const rawPredictions = await cocoModel.detect(imageSource);
    const results: DetectedEntity[] = [];

    for (let i = 0; i < rawPredictions.length; i++) {
      const p = rawPredictions[i];
      if (p.score < minScore) continue;

      const lowerClass = p.class.toLowerCase();
      const isAnimal = lowerClass in ANIMAL_CLASSES;
      const isPerson = lowerClass === 'person';

      if (isAnimal || isPerson) {
        const displayName = isAnimal
          ? ANIMAL_CLASSES[lowerClass]
          : 'Human Body (Subject)';

        results.push({
          id: `entity_${Date.now()}_${i}_${lowerClass}`,
          class: lowerClass,
          displayName,
          isAnimal,
          score: parseFloat(p.score.toFixed(3)),
          bbox: [
            Math.round(p.bbox[0]),
            Math.round(p.bbox[1]),
            Math.round(p.bbox[2]),
            Math.round(p.bbox[3])
          ]
        });
      }
    }

    return results;
  } catch (err) {
    return [];
  }
}
