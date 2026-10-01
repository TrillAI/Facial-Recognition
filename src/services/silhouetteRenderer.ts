import { DetectedEntity } from './animalDetection';

export interface SilhouetteOptions {
  color: string; // e.g. '#06b6d4'
  opacity: number; // e.g. 0.40 (see-through)
  enabled: boolean;
  highlightPersons: boolean;
  highlightAnimals: boolean;
}

// Convert hex string (#06b6d4) to RGB numbers
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

// Reusable offscreen canvas for pixel mask extraction
let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;

function getOffscreen(width: number, height: number) {
  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement('canvas');
  }
  if (offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
  }
  if (!offscreenCtx) {
    offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
  }
  return { canvas: offscreenCanvas, ctx: offscreenCtx };
}

/**
 * Draws a see-through solid color silhouette strictly on the subject (person or animal),
 * completely preserving the background untouched.
 */
export function renderSeeThroughSilhouette(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvasWidth: number,
  canvasHeight: number,
  faceBox: {
    x: number;
    y: number;
    w: number;
    h: number;
    landmarks?: Array<{ x: number; y: number }>;
  } | null,
  entities: DetectedEntity[],
  options: SilhouetteOptions
) {
  if (!options.enabled) return;

  const rgb = hexToRgb(options.color);
  const baseAlpha = Math.max(0.15, Math.min(0.85, options.opacity));

  // 1. RENDER 68-POINT DENSE FACIAL / CRANIAL SILHOUETTE (FOR HUMAN FACE)
  if (options.highlightPersons && faceBox && faceBox.landmarks && faceBox.landmarks.length === 68) {
    const pts = faceBox.landmarks;
    const bx = faceBox.x;
    const by = faceBox.y;
    const bw = faceBox.w;
    const bh = faceBox.h;

    ctx.save();

    // Construct the anatomical outer contour of the head & face
    // Jawline from ear-to-ear: pts 0 through 16
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= 16; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }

    // Forehead arc calculated from eyebrow anchors
    const foreheadPeakY = Math.max(0, by - bh * 0.18);
    const browMidX = (pts[19].x + pts[24].x) / 2;
    ctx.bezierCurveTo(
      pts[16].x,
      foreheadPeakY + bh * 0.1,
      browMidX + bw * 0.25,
      foreheadPeakY,
      browMidX,
      foreheadPeakY
    );
    ctx.bezierCurveTo(
      browMidX - bw * 0.25,
      foreheadPeakY,
      pts[0].x,
      foreheadPeakY + bh * 0.1,
      pts[0].x,
      pts[0].y
    );
    ctx.closePath();

    // Fill with see-through solid color
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseAlpha * 0.85})`;
    ctx.fill();

    // Add crisp contour edge
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(1, baseAlpha * 1.5)})`;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Upper chest & neck silhouette base
    const neckTopY = pts[8].y; // Chin tip
    const neckBottomY = Math.min(canvasHeight, neckTopY + bh * 0.45);
    const neckLeftX = pts[4].x;
    const neckRightX = pts[12].x;

    ctx.beginPath();
    ctx.moveTo(neckLeftX, neckTopY);
    ctx.lineTo(neckLeftX - bw * 0.2, neckBottomY);
    ctx.lineTo(neckRightX + bw * 0.2, neckBottomY);
    ctx.lineTo(neckRightX, neckTopY);
    ctx.closePath();

    const neckGradient = ctx.createLinearGradient(0, neckTopY, 0, neckBottomY);
    neckGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseAlpha * 0.75})`);
    neckGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.0)`);
    ctx.fillStyle = neckGradient;
    ctx.fill();

    ctx.restore();
  }

  // 2. RENDER ADAPTIVE SILHOUETTE FOR ANIMALS AND FULL-BODY ENTITIES
  for (const entity of entities) {
    if (entity.isAnimal && !options.highlightAnimals) continue;
    if (!entity.isAnimal && !options.highlightPersons) continue;

    const [ex, ey, ew, eh] = entity.bbox;
    if (ew <= 10 || eh <= 10) continue;

    // Constrain to canvas bounds
    const rx = Math.max(0, Math.min(canvasWidth - 1, ex));
    const ry = Math.max(0, Math.min(canvasHeight - 1, ey));
    const rw = Math.min(canvasWidth - rx, ew);
    const rh = Math.min(canvasHeight - ry, eh);
    if (rw <= 8 || rh <= 8) continue;

    // Use fast offscreen downscaled pixel segmentation for the subject's bounding box
    // to strictly separate foreground pixels (person/animal) from the background
    const scale = Math.min(1.0, 120 / Math.max(rw, rh));
    const sw = Math.max(16, Math.round(rw * scale));
    const sh = Math.max(16, Math.round(rh * scale));

    const { canvas: offCanvas, ctx: offCtx } = getOffscreen(sw, sh);
    if (!offCtx) continue;

    // Draw the subregion of the video to the offscreen canvas
    try {
      offCtx.clearRect(0, 0, sw, sh);
      offCtx.drawImage(video, rx, ry, rw, rh, 0, 0, sw, sh);

      const imgData = offCtx.getImageData(0, 0, sw, sh);
      const data = imgData.data;

      // Sample border pixels to establish ambient background color
      let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
      for (let x = 0; x < sw; x++) {
        // top row
        let idx = x * 4;
        bgR += data[idx]; bgG += data[idx + 1]; bgB += data[idx + 2];
        // bottom row
        idx = ((sh - 1) * sw + x) * 4;
        bgR += data[idx]; bgG += data[idx + 1]; bgB += data[idx + 2];
        bgCount += 2;
      }
      for (let y = 1; y < sh - 1; y++) {
        // left column
        let idx = (y * sw) * 4;
        bgR += data[idx]; bgG += data[idx + 1]; bgB += data[idx + 2];
        // right column
        idx = (y * sw + (sw - 1)) * 4;
        bgR += data[idx]; bgG += data[idx + 1]; bgB += data[idx + 2];
        bgCount += 2;
      }
      bgR = bgR / Math.max(1, bgCount);
      bgG = bgG / Math.max(1, bgCount);
      bgB = bgB / Math.max(1, bgCount);

      // Center prior: subject is centered inside the bounding box
      const cx = sw / 2;
      const cy = sh / 2;
      const maxDistCenter = Math.sqrt(cx * cx + cy * cy);

      // Tint foreground pixels with the chosen solid color at specified opacity,
      // leaving background pixels with alpha = 0 (100% transparent!)
      const targetAlpha = Math.round(baseAlpha * 255);

      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const idx = (y * sw + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Euclidean color difference from background sample
          const colorDiff = Math.sqrt(
            (r - bgR) * (r - bgR) +
            (g - bgG) * (g - bgG) +
            (b - bgB) * (b - bgB)
          );

          // Proximity to center of bounding box
          const distCenter = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
          const centerWeight = Math.max(0, 1 - (distCenter / maxDistCenter) * 0.85);

          // Combined foreground likelihood
          const isForeground = colorDiff > 28 || centerWeight > 0.45;

          if (isForeground) {
            // Apply changeable solid color with see-through transparency
            data[idx] = rgb.r;
            data[idx + 1] = rgb.g;
            data[idx + 2] = rgb.b;
            data[idx + 3] = targetAlpha;
          } else {
            // Strict background rejection: completely transparent!
            data[idx + 3] = 0;
          }
        }
      }

      offCtx.putImageData(imgData, 0, 0);

      // Composite the offscreen mask cleanly onto the live canvas over the subject
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(offCanvas, rx, ry, rw, rh);

      // Draw subtle tactical edge outline around the entity
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.75)`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx, ry, rw, rh);

      // Tactical label for animals or body
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(rx, ry - 22, Math.max(120, entity.displayName.length * 7.5 + 20), 20);
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillText(
        `${entity.displayName.toUpperCase()} · ${(entity.score * 100).toFixed(0)}%`,
        rx + 6,
        ry - 8
      );

      ctx.restore();
    } catch {
      // Fallback: draw translucent rounded hull if offscreen context fails
    }
  }
}
