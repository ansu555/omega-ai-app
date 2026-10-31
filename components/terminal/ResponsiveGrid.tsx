"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ResponsiveGridLayout as RGL,
  verticalCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";

export type ResponsiveGridLayoutProps = {
  children: ReactNode;
  className?: string;
  layouts: Record<string, readonly LayoutItem[]>;
  breakpoints: Record<string, number>;
  cols: Record<string, number>;
  rowHeight?: number;
  margin?: readonly [number, number];
  containerPadding?: readonly [number, number];
  draggableHandle?: string;
  preventCollision?: boolean;
  onLayoutChange?: (layout: Layout) => void;
};

export function ResponsiveGridLayout({
  children,
  className,
  layouts,
  breakpoints,
  cols,
  rowHeight = 36,
  margin = [10, 10],
  containerPadding = [0, 0],
  draggableHandle,
  onLayoutChange,
}: ResponsiveGridLayoutProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} className={className} style={{ width: "100%" }}>
      {width > 0 && (
        <RGL
          width={width}
          layouts={layouts}
          breakpoints={breakpoints}
          cols={cols}
          rowHeight={rowHeight}
          margin={margin}
          containerPadding={containerPadding}
          compactor={verticalCompactor}
          dragConfig={draggableHandle ? { handle: draggableHandle } : undefined}
          onLayoutChange={onLayoutChange}
        >
          {children}
        </RGL>
      )}
    </div>
  );
}
