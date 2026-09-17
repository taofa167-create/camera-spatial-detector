import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as tf from "@tensorflow/tfjs";
import {
  Camera,
  Check,
  CircleAlert,
  Cpu,
  Gauge,
  LockKeyhole,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";

import { describeRelation, type BBox } from "@/lib/spatial";

type AppState =
  | "idle"
  | "model-loading"
  | "camera-starting"
  | "camera-live"
  | "running"
  | "error";
type CameraError = { title: string; detail: string; action: string };
type Detection = cocoSsd.DetectedObject;
type PositionedDetection = Detection & {
  display: { left: number; top: number; width: number; height: number };
};

const SCAN_INTERVAL = 2000;
const MAX_NUM_BOXES = 2;
const HUD_HOLD_MS = 4500;

function formatTime(value: number | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function readableCameraError(error: unknown): CameraError {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      title: "Camera permission was not granted",
      detail: "Allow camera access in your browser settings, then try again.",
      action: "Check browser permissions",
    };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return {
      title: "No rear camera was found",
      detail: "Connect a camera or switch to a device with a rear-facing camera.",
      action: "Check camera hardware",
    };
  }
  return {
    title: "Camera could not start",
    detail: "The browser did not provide a usable camera stream.",
    action: "Check device and retry",
  };
}

function StatusDot({ state }: { state: AppState }) {
  const active = state === "running";
  const loading = state === "model-loading" || state === "camera-starting";
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        active ? "bg-accent" : loading ? "status-pulse bg-primary" : state === "error" ? "bg-destructive" : "bg-muted-foreground"
      }`}
    />
  );
}

export default function CameraLab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const timerRef = useRef<number | null>(null);
  const detectingRef = useRef(false);
  const hudLockedAtRef = useRef<number | null>(null);

  const [state, setState] = useState<AppState>("idle");
  const [error, setError] = useState<CameraError | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [relationshipText, setRelationshipText] = useState("");
  const [lastScan, setLastScan] = useState<number | null>(null);
  const [videoDimensions, setVideoDimensions] = useState("—");
  const [stageSize, setStageSize] = useState({ width: 1, height: 1 });
  const [secureContext, setSecureContext] = useState(false);
  const [hasStream, setHasStream] = useState(false);
  const [modelStatus, setModelStatus] = useState<"NOT LOADED" | "LOADING" | "READY">("NOT LOADED");

  useEffect(() => setSecureContext(window.isSecureContext), []);

  const stopCamera = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    detectingRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setHasStream(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }, []);

  const runDetection = useCallback(async () => {
    const video = videoRef.current;
    const detector = modelRef.current;
    if (!video || !detector || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || detectingRef.current) {
      return;
    }
    detectingRef.current = true;
    try {
      const predictions = await detector.detect(video, MAX_NUM_BOXES);
      setDetections(predictions);
      setLastScan(Date.now());

      const first = predictions[0];
      const second = predictions[1];
      if (first && second) {
        setRelationshipText(describeRelation(first.class, first.bbox as BBox, second.class, second.bbox as BBox));
        hudLockedAtRef.current = Date.now();
      } else {
        const lockedAt = hudLockedAtRef.current;
        if (lockedAt !== null && Date.now() - lockedAt < HUD_HOLD_MS) {
          // Hold view layer state
        } else {
          setRelationshipText("");
          hudLockedAtRef.current = null;
        }
      }
    } catch (e) {
      console.warn("Scan loop failed", e);
    } finally {
      detectingRef.current = false;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (state === "model-loading" || state === "camera-starting") return;
    stopCamera();
    setError(null);
    setDetections([]);
    setRelationshipText("");
    hudLockedAtRef.current = null;
    setLastScan(null);
    setState("camera-starting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setHasStream(true);
      if (!videoRef.current) throw new Error("DOM context offline");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setVideoDimensions(`${videoRef.current.videoWidth} × ${videoRef.current.videoHeight}`);
      setState("camera-live");
    } catch (err) {
      stopCamera();
      setError(readableCameraError(err));
      setState("error");
      return;
    }

    try {
      setState("model-loading");
      setModelStatus("LOADING");
      await tf.ready();
      modelRef.current = await cocoSsd.load();
      setModelStatus("READY");
      setState("running");
      timerRef.current = window.setInterval(() => void runDetection(), SCAN_INTERVAL);
    } catch {
      setModelStatus("NOT LOADED");
      setState("error");
    }
  }, [runDetection, state, stopCamera]);

  const stop = useCallback(() => {
    stopCamera();
    setDetections([]);
    setRelationshipText("");
    setLastScan(null);
    setVideoDimensions("—");
    setState("idle");
  }, [stopCamera]);

  useEffect(() => {
    if (!stageRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setStageSize({ width: entry.contentRect.width || 1, height: entry.contentRect.height || 1 });
    });
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  const positionedDetections = useMemo<PositionedDetection[]>(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return [];
    const sourceRatio = video.videoWidth / video.videoHeight;
    const stageRatio = stageSize.width / stageSize.height;
    const scale = stageRatio > sourceRatio ? stageSize.width / video.videoWidth : stageSize.height / video.videoHeight;
    return detections.map((det) => ({
      ...det,
      display: {
        left: (stageSize.width - video.videoWidth * scale) / 2 + det.bbox[0] * scale,
        top: (stageSize.height - video.videoHeight * scale) / 2 + det.bbox[1] * scale,
        width: det.bbox[2] * scale,
        height: det.bbox[3] * scale,
      },
    }));
  }, [detections, stageSize]);

  const running = state === "running" || state === "camera-live";

  return (
    <div className="p-4 flex flex-col gap-4">
      <div ref={stageRef} className="camera-stage relative border min-h-[300px] bg-black">
        <video ref={videoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
        {relationshipText && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white text-black p-2">{relationshipText}</div>}
      </div>
      <button onClick={running ? stop : startCamera} className="bg-primary text-white p-3 rounded">
        {running ? "Stop System Test" : "Initialize System Check"}
      </button>
    </div>
  );
    }
