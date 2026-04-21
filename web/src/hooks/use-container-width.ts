import { useEffect, useRef, useState } from "react";

export function useContainerWidth(defaultWidth = 800) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(defaultWidth);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setWidth(w);
      }
    });

    observer.observe(ref.current);
    // Set initial width
    setWidth(ref.current.clientWidth || defaultWidth);

    return () => observer.disconnect();
  }, [defaultWidth]);

  return { ref, width };
}
