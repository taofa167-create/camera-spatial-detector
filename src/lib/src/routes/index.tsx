import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useState } from "react";

// Camera + TensorFlow.js are browser-only: load the module after hydration.
const CameraLab = lazy(() => import("@/components/camera-lab"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Camera COCO-SSD Field Test | Spatial Detection Lab" },
      {
        name: "description",
        content:
          "Rear-camera field test running local COCO-SSD inference every 2 seconds, tracking two objects and reporting their spatial relationship on a frosted HUD.",
      },
      { property: "og:title", content: "Camera COCO-SSD Field Test" },
      {
        property: "og:description",
        content:
          "Local browser object detection with a 2000ms scan cadence, a strict 2-object limit, and live topological spatial readouts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function StageFallback() {
  return (
    <div className="lab-app flex min-h-[100dvh] items-center justify-center">
      <p className="instrument-mono uppercase text-muted-foreground">
        Initialising instrument…
      </p>
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
