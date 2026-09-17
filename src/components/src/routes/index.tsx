import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useState } from "react";

// Lazy load the camera module so it only initializes on the client side
const CameraLab = lazy(() => import("@/components/camera-lab"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Camera COCO-SSD Field Test | Spatial Detection Lab" },
      {
        name: "description",
        content: "Rear-camera field test running local COCO-SSD inference every 2 seconds.",
      },
    ],
  }),
  component: Index,
});

function StageFallback() {
  return (
    <div className="lab-app flex min-h-[100dvh] items-center justify-center">
      <p className="instrument-mono uppercase text-muted-foreground">Initialising instrument…</p>
    </div>
  );
}

function Index() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <StageFallback />;

  return (
    <Suspense fallback={<StageFallback />}>
      <CameraLab />
    </Suspense>
 
  );
}
