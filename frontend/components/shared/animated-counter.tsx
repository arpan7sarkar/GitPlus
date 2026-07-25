"use client";

import { useEffect, useRef, useState } from "react";
import { useSettingsStore } from "@/lib/stores/settings-store";

interface AnimatedCounterProps {
  end: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

export function AnimatedCounter({ end, duration = 1.5, suffix = "", prefix = "", className }: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const { settings } = useSettingsStore();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (settings.reducedMotion) { setCount(end); return; }

    let startTime: number;
    let frame: number;
    const updateCount = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.floor(eased * end));
      if (progress < 1) frame = requestAnimationFrame(updateCount);
    };
    frame = requestAnimationFrame(updateCount);
    return () => cancelAnimationFrame(frame);
  }, [end, duration, settings.reducedMotion]);

  return (
    <span className={className}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}
