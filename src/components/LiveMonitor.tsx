import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera,
  AlertTriangle,
  UserPlus,
  Sliders,
  Upload,
  CheckCircle2,
  RefreshCw,
  Zap,
  Trash2,
  Sparkles,
  Dog,
  Palette,
  Eye
} from 'lucide-react';
import {
  SubjectProfile,
  DetectionEvent,
  CameraSource,
  WatchlistCategory,
  generateUniqueEventId
} from '../types';
import { audioAlerts } from '../services/audio';
import {
  loadFaceApiModels,
  areModelsLoaded,
  faceapi,
  computeFaceDistance,
  distanceToSimilarity
} from '../services/faceDetection';
import {
  loadAnimalDetector,
  detectAnimalsAndEntities,
  DetectedEntity
} from '../services/animalDetection';
import {
  renderSeeThroughSilhouette,
  SilhouetteOptions
} from '../services/silhouetteRenderer';

interface LiveMonitorProps {
  subjects: SubjectProfile[];
  onEnrollFace: (capturedImage: string, suggestedName?: string, descriptor?: number[]) => void;
  onNewDetection: (event: DetectionEvent) => void;
  cameras: CameraSource[];
  onDeleteSubject?: (name: string) => Promise<void>;
}

interface EnrolledFaceProfile {
  name: string;
  category: WatchlistCategory;
  descriptor: Float32Array;
}

const SILHOUETTE_COLORS = [
  { name: 'Cyber Cyan', hex: '#06b6d4' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Amber Gold', hex: '#f59e0b' },
  { name: 'Tactical Rose', hex: '#f43f5e' },
  { name: 'Neon Purple', hex: '#a855f7' },
  { name: 'Electric Sky', hex: '#38bdf8' },
  { name: 'Infrared Orange', hex: '#ff7a00' }
];

export const LiveMonitor: React.FC<LiveMonitorProps> = ({
  subjects,
  onEnrollFace,
  onNewDetection,
  cameras,
  onDeleteSubject
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isModelLoading, setIsModelLoading] = useState<boolean>(!areModelsLoaded());
  const [modelError, setModelError] = useState<string | null>(null);

  const [selectedCameraId, setSelectedCameraId] = useState<string>('cam_webcam');
  const [hasWebcamAccess, setHasWebcamAccess] = useState<boolean>(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  const [minConfidence, setMinConfidence] = useState<number>(0.72);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true);
  const [showMeshLines, setShowMeshLines] = useState<boolean>(true);
  const [boloAlarmActive, setBoloAlarmActive] = useState<boolean>(false);
  const [currentFps, setCurrentFps] = useState<number>(60);
  const [currentLatency, setCurrentLatency] = useState<number>(8.5);

  // See-Through Silhouette Settings (Changeable solid color, only on subject, never background)
  const [silhouetteEnabled, setSilhouetteEnabled] = useState<boolean>(true);
  const [silhouetteColor, setSilhouetteColor] = useState<string>('#06b6d4');
  const [silhouetteOpacity, setSilhouetteOpacity] = useState<number>(0.42);
  const [highlightPersons, setHighlightPersons] = useState<boolean>(true);
  const [highlightAnimals, setHighlightAnimals] = useState<boolean>(true);

  // Animal recognition
  const [animalDetectorReady, setAnimalDetectorReady] = useState<boolean>(false);
  const detectedEntitiesRef = useRef<DetectedEntity[]>([]);
  const [detectedAnimalsCount, setDetectedAnimalsCount] = useState<number>(0);
  const [latestAnimalName, setLatestAnimalName] = useState<string | null>(null);

  // Quick Watchlist Deletion in Live View
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);
  const [isDeletingSubject, setIsDeletingSubject] = useState<string | null>(null);

  // Cached descriptors of enrolled faces for real-time 1:1 recognition
  const enrolledDescriptorsRef = useRef<EnrolledFaceProfile[]>([]);
  // Cached descriptor of currently tracked face in view
  const latestDescriptorRef = useRef<Float32Array | null>(null);

  // Persistent smoothed bounding box strictly anchored to the face
  const smoothedBoxRef = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
    lastDetectedTime: number;
    landmarks?: Array<{ x: number; y: number }>;
    subjectName: string;
    category: WatchlistCategory;
    similarity: number;
    age?: number;
    gender?: string;
  } | null>(null);

  // Active face state for UI info and snapshot enrollment
  const [activeFaceInfo, setActiveFaceInfo] = useState<{
    subjectName: string;
    category: WatchlistCategory;
    confidence: number;
    age?: number;
    gender?: string;
  } | null>(null);

  // Recent feed detections
  const [liveDetections, setLiveDetections] = useState<DetectionEvent[]>([]);

  // 1. Load Face-API Neural Models & Animal Detector
  useEffect(() => {
    let isMounted = true;
    loadFaceApiModels()
      .then(() => {
        if (isMounted) {
          setIsModelLoading(false);
          setModelError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setIsModelLoading(false);
          setModelError(err.message || 'Failed to load local ML models');
        }
      });

    loadAnimalDetector()
      .then(() => {
        if (isMounted) setAnimalDetectorReady(true);
      })
      .catch(() => null);

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Pre-compute / Cache 128-D descriptors for enrolled subjects
  useEffect(() => {
    if (!areModelsLoaded()) return;

    let isCancelled = false;

    const computeDescriptors = async () => {
      const list: EnrolledFaceProfile[] = [];

      for (const sub of subjects) {
        if (isCancelled) return;

        // Path A: Subject already has pre-computed 128-D descriptor stored in database
        if (sub.descriptor && Array.isArray(sub.descriptor) && sub.descriptor.length === 128) {
          list.push({
            name: sub.name,
            category: sub.category,
            descriptor: new Float32Array(sub.descriptor)
          });
          continue;
        }

        // Path B: Compute descriptor from stored photo/base64
        const imgSrc = sub.imagePath || sub.imageData;
        if (!imgSrc) continue;

        try {
          const img = new Image();
          if (imgSrc.startsWith('http://') || imgSrc.startsWith('https://')) {
            img.crossOrigin = 'anonymous';
          }
          img.src = imgSrc;
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
          });

          const detection = await faceapi
            .detectSingleFace(
              img,
              new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.25 })
            )
            .withFaceLandmarks(true)
            .withFaceDescriptor();

          if (detection) {
            list.push({
              name: sub.name,
              category: sub.category,
              descriptor: detection.descriptor
            });
          }
        } catch {
          // Skip unparsable images
        }
      }

      if (!isCancelled) {
        enrolledDescriptorsRef.current = list;
        console.log(
          `[Lookout Face Engine] ${list.length} enrolled subjects armed for biometric matching:`,
          list.map((l) => l.name)
        );
      }
    };

    computeDescriptors();

    return () => {
      isCancelled = true;
    };
  }, [subjects, isModelLoading]);

  // 3. Start/Stop webcam
  const startWebcam = useCallback(async () => {
    try {
      setWebcamError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 60, min: 30 }
          },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setHasWebcamAccess(true);
      } else {
        throw new Error('Camera access not supported in this browser');
      }
    } catch (err: any) {
      setHasWebcamAccess(false);
      setWebcamError(err.message || 'Webcam access denied or unavailable');
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (selectedCameraId === 'cam_webcam') {
      startWebcam();
    } else {
      stopWebcam();
      setHasWebcamAccess(false);
    }
    return () => {
      stopWebcam();
    };
  }, [selectedCameraId, startWebcam, stopWebcam]);

  // Handle local video file upload
  const handleVideoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && videoRef.current) {
      const url = URL.createObjectURL(file);
      videoRef.current.srcObject = null;
      videoRef.current.src = url;
      videoRef.current.loop = true;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => null);
    }
  };

  // 4. PARALLEL ANIMAL & ENTITY DETECTION LOOP
  useEffect(() => {
    let isActive = true;
    let timer: any = null;
    let lastAnimalLogTime = 0;

    const runAnimalDetection = async () => {
      if (!isActive) return;

      const video = videoRef.current;
      if (video && video.readyState >= 2 && !video.paused) {
        try {
          const entities = await detectAnimalsAndEntities(video, 0.40);
          detectedEntitiesRef.current = entities;

          const animals = entities.filter((e) => e.isAnimal);
          setDetectedAnimalsCount(animals.length);

          if (animals.length > 0) {
            setLatestAnimalName(animals[0].displayName);

            // Log animal detection event periodically (every 6 seconds)
            const now = performance.now();
            if (now - lastAnimalLogTime > 6000) {
              lastAnimalLogTime = now;
              const primaryAnimal = animals[0];
              const animalEvt: DetectionEvent = {
                id: generateUniqueEventId(),
                timestamp: new Date().toISOString(),
                cameraId: selectedCameraId,
                cameraName:
                  selectedCameraId === 'cam_webcam'
                    ? 'Primary Live Webcam'
                    : 'Video Stream',
                subjectName: primaryAnimal.displayName,
                category: 'guest',
                confidence: primaryAnimal.score,
                box: {
                  x_min: primaryAnimal.bbox[0],
                  y_min: primaryAnimal.bbox[1],
                  x_max: primaryAnimal.bbox[0] + primaryAnimal.bbox[2],
                  y_max: primaryAnimal.bbox[1] + primaryAnimal.bbox[3]
                }
              };
              setLiveDetections((prev) => {
                const withoutDup = prev.filter((e) => e.id !== animalEvt.id);
                return [animalEvt, ...withoutDup.slice(0, 14)];
              });
              onNewDetection(animalEvt);
            }
          } else {
            setLatestAnimalName(null);
          }
        } catch {
          // Ignore transient detection errors
        }
      }

      timer = setTimeout(runAnimalDetection, 200);
    };

    timer = setTimeout(runAnimalDetection, 600);
    return () => {
      isActive = false;
      if (timer) clearTimeout(timer);
    };
  }, [selectedCameraId, onNewDetection]);

  // 5. PARALLEL ULTRA-FAST ML FACE DETECTION LOOP
  useEffect(() => {
    let isActive = true;
    let isDetecting = false;
    let timeoutId: any = null;
    let lastBiometricTime = 0;
    let lastLogTime = 0;

    const detectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.40
    });

    const runDetection = async () => {
      if (!isActive) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (
        !isDetecting &&
        areModelsLoaded() &&
        video &&
        video.readyState >= 2 &&
        !video.paused &&
        canvas
      ) {
        isDetecting = true;
        const t0 = performance.now();

        try {
          // Fast detection with 68 landmarks
          const rawDetections = await faceapi
            .detectAllFaces(video, detectorOptions)
            .withFaceLandmarks(true);

          const elapsed = performance.now() - t0;
          setCurrentLatency(parseFloat(elapsed.toFixed(1)));

          const now = performance.now();
          const width = canvas.width || 960;
          const height = canvas.height || 540;

          if (rawDetections && rawDetections.length > 0) {
            const resized = faceapi.resizeResults(rawDetections, { width, height });
            const best = resized[0];
            const box = best.detection.box;

            const landmarkPoints = best.landmarks.positions.map((p) => ({
              x: Math.round(p.x),
              y: Math.round(p.y)
            }));

            // Biometric recognition extraction (every ~300ms)
            if (now - lastBiometricTime > 300) {
              lastBiometricTime = now;

              faceapi
                .detectSingleFace(video, detectorOptions)
                .withFaceLandmarks(true)
                .withAgeAndGender()
                .withFaceDescriptor()
                .then((fullResult) => {
                  if (!fullResult || !isActive) return;

                  // Cache descriptor for instant 1-click enrollment
                  if (fullResult.descriptor) {
                    latestDescriptorRef.current = fullResult.descriptor;
                  }

                  let matchedName = 'Unregistered Person';
                  let matchedCategory: WatchlistCategory = 'unknown';
                  let bestSim = 0.65;

                  if (fullResult.descriptor && enrolledDescriptorsRef.current.length > 0) {
                    let lowestDistance = 1.0;
                    let closest: EnrolledFaceProfile | null = null;

                    for (const enrolled of enrolledDescriptorsRef.current) {
                      const dist = computeFaceDistance(fullResult.descriptor, enrolled.descriptor);
                      if (dist < lowestDistance) {
                        lowestDistance = dist;
                        closest = enrolled;
                      }
                    }

                    // FaceNet 128-D Euclidean Distance matching:
                    // Euclidean distance < 0.60 is the standard FaceNet match threshold!
                    // Tolerance is derived from slider: 0.72 -> allowed distance 0.61; 0.85 -> allowed distance 0.49
                    const maxAllowedDistance = 0.60 + (0.75 - minConfidence) * 0.45;

                    if (closest && lowestDistance <= maxAllowedDistance) {
                      bestSim = distanceToSimilarity(lowestDistance);
                      matchedName = closest.name;
                      matchedCategory = closest.category;
                    }
                  }

                  if (smoothedBoxRef.current) {
                    smoothedBoxRef.current.subjectName = matchedName;
                    smoothedBoxRef.current.category = matchedCategory;
                    smoothedBoxRef.current.similarity = bestSim;
                    smoothedBoxRef.current.age = fullResult.age ? Math.round(fullResult.age) : undefined;
                    smoothedBoxRef.current.gender = fullResult.gender;
                  }

                  setActiveFaceInfo({
                    subjectName: matchedName,
                    category: matchedCategory,
                    confidence: bestSim,
                    age: fullResult.age ? Math.round(fullResult.age) : undefined,
                    gender: fullResult.gender
                  });

                  if (matchedCategory === 'bolo') {
                    setBoloAlarmActive(true);
                    audioAlerts.playBoloAlert();
                  } else {
                    setBoloAlarmActive(false);
                  }

                  // Periodic event logging (every 4 seconds)
                  if (now - lastLogTime > 4000) {
                    lastLogTime = now;
                    const newEvt: DetectionEvent = {
                      id: generateUniqueEventId(),
                      timestamp: new Date().toISOString(),
                      cameraId: selectedCameraId,
                      cameraName:
                        selectedCameraId === 'cam_webcam'
                          ? 'Primary Live Webcam'
                          : 'Video Stream',
                      subjectName: matchedName,
                      category: matchedCategory,
                      confidence: bestSim,
                      box: {
                        x_min: Math.round(box.x),
                        y_min: Math.round(box.y),
                        x_max: Math.round(box.x + box.width),
                        y_max: Math.round(box.y + box.height)
                      },
                      age: fullResult.age
                        ? { low: Math.round(fullResult.age) - 3, high: Math.round(fullResult.age) + 3 }
                        : undefined,
                      gender: fullResult.gender
                    };

                    setLiveDetections((prev) => {
                      const withoutDup = prev.filter((e) => e.id !== newEvt.id);
                      return [newEvt, ...withoutDup.slice(0, 14)];
                    });
                    onNewDetection(newEvt);
                  }
                })
                .catch(() => null);
            }

            // High-responsiveness EMA (0.82) ensures the square sticks tightly with real motion
            if (!smoothedBoxRef.current) {
              smoothedBoxRef.current = {
                x: box.x,
                y: box.y,
                w: box.width,
                h: box.height,
                lastDetectedTime: now,
                landmarks: landmarkPoints,
                subjectName: activeFaceInfo?.subjectName || 'Analyzing Biometrics...',
                category: activeFaceInfo?.category || 'unknown',
                similarity: activeFaceInfo?.confidence || 0.88
              };
            } else {
              const alpha = 0.82;
              smoothedBoxRef.current.x = smoothedBoxRef.current.x * (1 - alpha) + box.x * alpha;
              smoothedBoxRef.current.y = smoothedBoxRef.current.y * (1 - alpha) + box.y * alpha;
              smoothedBoxRef.current.w = smoothedBoxRef.current.w * (1 - alpha) + box.width * alpha;
              smoothedBoxRef.current.h = smoothedBoxRef.current.h * (1 - alpha) + box.height * alpha;
              smoothedBoxRef.current.lastDetectedTime = now;
              smoothedBoxRef.current.landmarks = landmarkPoints;
            }
          } else {
            // Face lost check: if no face for 350ms, clear
            if (smoothedBoxRef.current && now - smoothedBoxRef.current.lastDetectedTime > 350) {
              smoothedBoxRef.current = null;
              setActiveFaceInfo(null);
              setBoloAlarmActive(false);
            }
          }
        } catch {
          // Ignore transient detection errors
        } finally {
          isDetecting = false;
        }
      }

      timeoutId = setTimeout(runDetection, 12);
    };

    timeoutId = setTimeout(runDetection, 100);
    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [minConfidence, selectedCameraId, onNewDetection, activeFaceInfo]);

  // 6. SYNCHRONOUS 60-FPS CANVAS RENDER LOOP (With See-Through Silhouette on Subjects Only)
  useEffect(() => {
    let animId: number;
    let frameCount = 0;
    let fpsTimer = performance.now();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const render = (time: number) => {
      frameCount++;
      if (time - fpsTimer >= 1000) {
        setCurrentFps(frameCount);
        frameCount = 0;
        fpsTimer = time;
      }

      const width = canvas.width || 960;
      const height = canvas.height || 540;

      const video = videoRef.current;
      const hasLiveVideo = video && video.readyState >= 2 && !video.paused;

      if (hasLiveVideo) {
        // 1. Draw raw camera video frame at 60 FPS
        ctx.drawImage(video, 0, 0, width, height);

        // 2. RENDER SEE-THROUGH SOLID COLOR SILHOUETTE (Strictly on Subject, Never Background)
        if (silhouetteEnabled) {
          renderSeeThroughSilhouette(
            ctx,
            video,
            width,
            height,
            smoothedBoxRef.current,
            detectedEntitiesRef.current,
            {
              color: silhouetteColor,
              opacity: silhouetteOpacity,
              enabled: silhouetteEnabled,
              highlightPersons,
              highlightAnimals
            }
          );
        }

        // 3. Render sticky biometric bounding box & 68 landmarks
        const cur = smoothedBoxRef.current;
        if (cur && time - cur.lastDetectedTime < 450) {
          const bx = Math.round(cur.x);
          const by = Math.round(cur.y);
          const bw = Math.round(cur.w);
          const bh = Math.round(cur.h);

          let strokeColor = '#34d399'; // Emerald (Authorized)
          let fillColor = 'rgba(52, 211, 153, 0.08)';

          if (cur.category === 'vip') {
            strokeColor = '#38bdf8'; // Sky Blue (VIP)
            fillColor = 'rgba(56, 189, 248, 0.08)';
          } else if (cur.category === 'bolo') {
            strokeColor = '#f43f5e'; // Rose (BOLO)
            fillColor = 'rgba(244, 63, 94, 0.2)';
          } else if (cur.category === 'unknown') {
            strokeColor = '#fbbf24'; // Amber (Unregistered)
            fillColor = 'rgba(251, 191, 36, 0.08)';
          }

          // A. Corner Brackets
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 2.5;
          const bracketLen = Math.min(28, bw * 0.25);

          // Top-Left
          ctx.beginPath();
          ctx.moveTo(bx, by + bracketLen);
          ctx.lineTo(bx, by);
          ctx.lineTo(bx + bracketLen, by);
          ctx.stroke();

          // Top-Right
          ctx.beginPath();
          ctx.moveTo(bx + bw - bracketLen, by);
          ctx.lineTo(bx + bw, by);
          ctx.lineTo(bx + bw, by + bracketLen);
          ctx.stroke();

          // Bottom-Left
          ctx.beginPath();
          ctx.moveTo(bx, by + bh - bracketLen);
          ctx.lineTo(bx, by + bh);
          ctx.lineTo(bx + bracketLen, by + bh);
          ctx.stroke();

          // Bottom-Right
          ctx.beginPath();
          ctx.moveTo(bx + bw - bracketLen, by + bh);
          ctx.lineTo(bx + bw, by + bh);
          ctx.lineTo(bx + bw, by + bh - bracketLen);
          ctx.stroke();

          // Soft tint if silhouette is disabled
          if (!silhouetteEnabled) {
            ctx.fillStyle = fillColor;
            ctx.fillRect(bx, by, bw, bh);
          }

          // B. 68 Dense Facial Landmarks Wireframe Mesh
          if (showLandmarks && cur.landmarks && cur.landmarks.length === 68) {
            const pts = cur.landmarks;

            if (showMeshLines) {
              ctx.strokeStyle =
                strokeColor === '#f43f5e'
                  ? 'rgba(244, 63, 94, 0.45)'
                  : 'rgba(56, 189, 248, 0.4)';
              ctx.lineWidth = 1;

              // 1. Jawline: 0 to 16
              ctx.beginPath();
              ctx.moveTo(pts[0].x, pts[0].y);
              for (let i = 1; i <= 16; i++) ctx.lineTo(pts[i].x, pts[i].y);
              ctx.stroke();

              // 2. Left Eyebrow: 17 to 21
              ctx.beginPath();
              ctx.moveTo(pts[17].x, pts[17].y);
              for (let i = 18; i <= 21; i++) ctx.lineTo(pts[i].x, pts[i].y);
              ctx.stroke();

              // 3. Right Eyebrow: 22 to 26
              ctx.beginPath();
              ctx.moveTo(pts[22].x, pts[22].y);
              for (let i = 23; i <= 26; i++) ctx.lineTo(pts[i].x, pts[i].y);
              ctx.stroke();

              // 4. Nose Bridge & Nostril Base: 27-30 & 31-35
              ctx.beginPath();
              ctx.moveTo(pts[27].x, pts[27].y);
              for (let i = 28; i <= 30; i++) ctx.lineTo(pts[i].x, pts[i].y);
              ctx.stroke();

              ctx.beginPath();
              ctx.moveTo(pts[31].x, pts[31].y);
              for (let i = 32; i <= 35; i++) ctx.lineTo(pts[i].x, pts[i].y);
              ctx.stroke();

              // 5. Left Eye Contour: 36 to 41 (closed loop)
              ctx.beginPath();
              ctx.moveTo(pts[36].x, pts[36].y);
              for (let i = 37; i <= 41; i++) ctx.lineTo(pts[i].x, pts[i].y);
              ctx.closePath();
              ctx.stroke();

              // 6. Right Eye Contour: 42 to 47 (closed loop)
              ctx.beginPath();
              ctx.moveTo(pts[42].x, pts[42].y);
              for (let i = 43; i <= 47; i++) ctx.lineTo(pts[i].x, pts[i].y);
              ctx.closePath();
              ctx.stroke();

              // 7. Outer Lips: 48 to 59 (closed loop)
              ctx.beginPath();
              ctx.moveTo(pts[48].x, pts[48].y);
              for (let i = 49; i <= 59; i++) ctx.lineTo(pts[i].x, pts[i].y);
              ctx.closePath();
              ctx.stroke();

              // 8. Inner Lips: 60 to 67 (closed loop)
              ctx.beginPath();
              ctx.moveTo(pts[60].x, pts[60].y);
              for (let i = 61; i <= 67; i++) ctx.lineTo(pts[i].x, pts[i].y);
              ctx.closePath();
              ctx.stroke();
            }

            // Draw landmark points
            ctx.fillStyle = strokeColor;
            for (let i = 0; i < 68; i++) {
              ctx.beginPath();
              ctx.arc(pts[i].x, pts[i].y, 2.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // C. Tactical Header Lockup (Recognized Subject Name + Similarity %)
          ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
          ctx.fillRect(bx, by - 32, bw, 28);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(bx, by - 32, bw, 28);

          ctx.fillStyle = strokeColor;
          ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(cur.subjectName, bx + 8, by - 13);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.fillText(`${(cur.similarity * 100).toFixed(1)}%`, bx + bw - 48, by - 13);

          // D. Sub-tag bar below box
          ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
          ctx.fillRect(bx, by + bh + 4, bw, 20);

          ctx.fillStyle = strokeColor;
          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.fillText(`STATUS: ${cur.category.toUpperCase()}`, bx + 8, by + bh + 18);

          if (cur.age) {
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText(`AGE: ~${cur.age} · ${cur.gender || ''}`, bx + bw - 82, by + bh + 18);
          }
        } else if (detectedAnimalsCount === 0) {
          // NO FACE OR ANIMAL DETECTED
          ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
          ctx.fillRect(20, height - 42, 280, 26);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '11px "JetBrains Mono", monospace';
          ctx.fillText('NO TARGET DETECTED · LOOK AT CAMERA', 30, height - 25);
        }
      } else {
        // Standby screen
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#64748b';
        ctx.font = '14px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          webcamError
            ? `Camera Access Error: ${webcamError}`
            : 'Camera feed idle. Allow camera permissions to start.',
          width / 2,
          height / 2
        );
        ctx.textAlign = 'start';
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    showLandmarks,
    showMeshLines,
    webcamError,
    silhouetteEnabled,
    silhouetteColor,
    silhouetteOpacity,
    highlightPersons,
    highlightAnimals,
    detectedAnimalsCount
  ]);

  // Capture clean face snapshot from video (zero green HUD overlays) for enrollment
  const handleCaptureSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;

    // Draw clean unannotated frame from raw video source
    const offCanvas = document.createElement('canvas');
    offCanvas.width = video.videoWidth || 640;
    offCanvas.height = video.videoHeight || 480;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    offCtx.drawImage(video, 0, 0, offCanvas.width, offCanvas.height);
    const cleanDataUrl = offCanvas.toDataURL('image/jpeg', 0.95);

    // Pass the active 128-D descriptor directly from memory for 100% exact recognition match
    const liveDescriptor = latestDescriptorRef.current
      ? Array.from(latestDescriptorRef.current)
      : undefined;

    onEnrollFace(
      cleanDataUrl,
      activeFaceInfo && activeFaceInfo.subjectName !== 'Unregistered Person'
        ? activeFaceInfo.subjectName
        : undefined,
      liveDescriptor
    );
  };

  // Quick Watchlist item deletion directly from Live Monitor
  const handleQuickDeleteSubject = async (subName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDeleteSubject) return;

    if (confirmDeleteName !== subName) {
      setConfirmDeleteName(subName);
      setTimeout(() => {
        setConfirmDeleteName((cur) => (cur === subName ? null : cur));
      }, 5000);
      return;
    }

    setConfirmDeleteName(null);
    setIsDeletingSubject(subName);
    try {
      await onDeleteSubject(subName);
    } catch {
      // Ignored
    } finally {
      setIsDeletingSubject(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 max-w-7xl mx-auto">
      {/* Main Viewport & Tactical HUD (Span 3 Cols) */}
      <div className="lg:col-span-3 flex flex-col gap-4">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-cyan-400" />
              <label htmlFor="cam-select" className="text-xs font-medium text-slate-400">
                Input Source:
              </label>
              <select
                id="cam-select"
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-400"
              >
                <option value="cam_webcam">Primary Camera (Live Hardware Webcam)</option>
                <option value="cam_video_file">Local Video Clip / File (Real Footage)</option>
              </select>
            </div>

            {selectedCameraId === 'cam_video_file' && (
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-md border border-slate-700 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  Load Video File
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-400">
              <span className="text-emerald-400 font-semibold">{currentFps} FPS</span>
              <span className="text-slate-600">·</span>
              <span className="text-cyan-400 font-semibold flex items-center gap-1">
                <Zap className="w-3 h-3 text-cyan-400" />
                {currentLatency}ms
              </span>
            </div>

            <button
              onClick={() => setShowLandmarks(!showLandmarks)}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                showLandmarks
                  ? 'bg-cyan-950/60 border-cyan-800 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              68 Landmarks {showLandmarks ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => setShowMeshLines(!showMeshLines)}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                showMeshLines
                  ? 'bg-cyan-950/60 border-cyan-800 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Mesh {showMeshLines ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Video Canvas Container */}
        <div
          className={`relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border-2 transition-all duration-300 shadow-2xl ${
            boloAlarmActive
              ? 'border-rose-500 shadow-rose-950/50 animate-pulse'
              : 'border-slate-800'
          }`}
        >
          {/* HTML5 video element for webcam */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="hidden"
          />

          {/* Master Canvas */}
          <canvas
            ref={canvasRef}
            width={960}
            height={540}
            className="w-full h-full object-cover block"
          />

          {/* Model Loading State */}
          {isModelLoading && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
              <div className="text-xs font-mono text-slate-300">
                Initializing WebGL Neural Acceleration & Animal Engine...
              </div>
            </div>
          )}

          {/* Animal In Frame Indicator */}
          {detectedAnimalsCount > 0 && (
            <div className="absolute top-4 left-4 bg-emerald-950/90 border border-emerald-500 text-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-2 font-mono text-xs backdrop-blur-md shadow-lg animate-pulse">
              <Dog className="w-4 h-4 text-emerald-400" />
              <span>
                ANIMAL DETECTED: {latestAnimalName || 'Wildlife'} ({detectedAnimalsCount})
              </span>
            </div>
          )}

          {/* BOLO Alert Banner */}
          {boloAlarmActive && (
            <div className="absolute top-4 left-4 right-4 bg-rose-950/90 border border-rose-600 rounded-lg p-3 flex items-center justify-between text-rose-100 backdrop-blur-md animate-bounce">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
                <span className="font-bold text-sm tracking-wide font-mono">
                  SECURITY ALERT: BOLO SUBJECT IN FRAME ({activeFaceInfo?.subjectName})
                </span>
              </div>
              <button
                onClick={() => setBoloAlarmActive(false)}
                className="text-xs bg-rose-800 hover:bg-rose-700 text-white px-2.5 py-1 rounded cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Action overlay: Enroll Real Face */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            <button
              onClick={handleCaptureSnapshot}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-lg backdrop-blur-md transition-colors cursor-pointer shadow-lg"
            >
              <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
              Enroll Face in View
            </button>
          </div>
        </div>

        {/* DEDICATED CHANGEABLE SEE-THROUGH SILHOUETTE & ANIMAL RECOGNITION CONTROL BAR */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  See-Through Silhouette Mask
                </span>
              </div>

              <button
                onClick={() => setSilhouetteEnabled(!silhouetteEnabled)}
                className={`text-xs px-2.5 py-1 rounded-md font-mono font-semibold transition-colors cursor-pointer border ${
                  silhouetteEnabled
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                SILHOUETTE {silhouetteEnabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {/* Target Selectors: Person & Animal */}
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={highlightPersons}
                  onChange={(e) => setHighlightPersons(e.target.checked)}
                  className="accent-cyan-400 rounded"
                />
                <span>Humans</span>
              </label>

              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={highlightAnimals}
                  onChange={(e) => setHighlightAnimals(e.target.checked)}
                  className="accent-emerald-400 rounded"
                />
                <span className="flex items-center gap-1">
                  <Dog className="w-3 h-3 text-emerald-400" />
                  Animals (Pets/Wildlife)
                </span>
              </label>
            </div>
          </div>

          {/* Color Palette & Transparency Slider */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            {/* Color Swatch Selection */}
            <div className="flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-xs font-medium text-slate-400 mr-1">Solid Color:</span>
              <div className="flex items-center gap-1.5">
                {SILHOUETTE_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => setSilhouetteColor(c.hex)}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer border-2 ${
                      silhouetteColor.toLowerCase() === c.hex.toLowerCase()
                        ? 'scale-125 border-white shadow-md'
                        : 'border-transparent hover:scale-110 opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}

                {/* Custom Color Input */}
                <label className="relative cursor-pointer ml-1" title="Pick any custom solid color">
                  <input
                    type="color"
                    value={silhouetteColor}
                    onChange={(e) => setSilhouetteColor(e.target.value)}
                    className="sr-only"
                  />
                  <div
                    className="w-6 h-6 rounded-full border-2 border-slate-600 flex items-center justify-center text-[9px] font-bold text-slate-200"
                    style={{ backgroundColor: silhouetteColor }}
                  >
                    +
                  </div>
                </label>
              </div>
            </div>

            {/* Transparency Slider */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-400">
                See-Through Opacity:{' '}
                <span className="font-mono text-cyan-400 tabular-nums">
                  {(silhouetteOpacity * 100).toFixed(0)}%
                </span>
              </span>
              <input
                type="range"
                min="0.18"
                max="0.75"
                step="0.03"
                value={silhouetteOpacity}
                onChange={(e) => setSilhouetteOpacity(parseFloat(e.target.value))}
                className="w-28 accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-300">
                Match Sensitivity:{' '}
                <span className="font-mono text-cyan-400 tabular-nums">
                  {(minConfidence * 100).toFixed(0)}%
                </span>
              </span>
            </div>
            <input
              type="range"
              min="0.60"
              max="0.90"
              step="0.02"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="w-32 accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">
              {enrolledDescriptorsRef.current.length} Face
              {enrolledDescriptorsRef.current.length !== 1 ? 's' : ''} Biometrically Armed
            </span>
            <span aria-hidden="true">·</span>
            <span>Animal AI Engine Active</span>
          </div>
        </div>
      </div>

      {/* Right Column: Live Detections Stream & Enrolled Watchlist */}
      <div className="flex flex-col gap-6">
        {/* Enrolled Subjects Status With In-UI Quick Delete */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Watchlist ({subjects.length})
            </h2>
            <span className="text-xs font-mono text-cyan-400">128-D Descriptors</span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
            {subjects.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500">
                No subjects enrolled yet. Click "Enroll Face in View".
              </div>
            ) : (
              subjects.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs group"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {sub.imagePath || sub.imageData ? (
                      <img
                        src={sub.imagePath || sub.imageData}
                        alt={sub.name}
                        referrerPolicy="no-referrer"
                        className="w-6 h-6 rounded object-cover border border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                        {sub.name.charAt(0)}
                      </div>
                    )}
                    <span className="font-medium text-slate-200 truncate">{sub.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-slate-400 capitalize">
                      {sub.category}
                    </span>

                    {/* Quick Delete Subject Button */}
                    {onDeleteSubject && (
                      <button
                        onClick={(e) => handleQuickDeleteSubject(sub.name, e)}
                        disabled={isDeletingSubject === sub.name}
                        className={`p-1 rounded transition-colors cursor-pointer ${
                          confirmDeleteName === sub.name
                            ? 'bg-rose-950 text-rose-300 border border-rose-500 text-[10px] font-bold animate-pulse px-1.5'
                            : 'text-slate-500 hover:text-rose-400 hover:bg-slate-800'
                        }`}
                        title={
                          confirmDeleteName === sub.name
                            ? 'Click again to permanently delete'
                            : 'Delete subject'
                        }
                      >
                        {confirmDeleteName === sub.name ? (
                          'Confirm?'
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Detection Feed */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-3 flex-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Live Real Event Feed
            </h2>
            <span className="text-xs font-mono text-emerald-400">Real-time</span>
          </div>

          <div className="flex flex-col gap-2 overflow-y-auto max-h-[380px] pr-1">
            {liveDetections.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                Waiting for real face or animal in camera feed...
              </div>
            ) : (
              liveDetections.map((evt, idx) => {
                let badgeClass = 'text-emerald-400';
                if (evt.category === 'vip') badgeClass = 'text-sky-400';
                if (evt.category === 'bolo') badgeClass = 'text-rose-400 font-bold';
                if (evt.category === 'unknown') badgeClass = 'text-amber-400';

                return (
                  <div
                    key={`${evt.id}-${evt.timestamp}-${idx}`}
                    className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {evt.snapshotUrl ? (
                        <img
                          src={evt.snapshotUrl}
                          alt={evt.subjectName}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded object-cover border border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                          {evt.subjectName.charAt(0)}
                        </div>
                      )}
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-200 truncate">
                          {evt.subjectName}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono tabular-nums">
                          <span className={badgeClass}>{evt.category.toUpperCase()}</span>
                          <span aria-hidden="true">·</span>
                          <span>{(evt.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
                      {new Date(evt.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
