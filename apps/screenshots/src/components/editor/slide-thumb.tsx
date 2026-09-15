"use client";
import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LAYOUT_LABEL } from "@/lib/constants";
import { pickText } from "@/lib/locale";
import type { Device, Orientation, Slide, Theme } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DeckCanvas, getCanvas } from "./slide-canvas";

type Props = {
  slide: Slide;
  slides: Slide[];
  index: number;
  active: boolean;
  device: Device;
  orientation: Orientation;
  theme: Theme;
  locale: string;
  appName?: string;
  appIcon?: string;
  connectedCanvas: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
};

// Thumb tile target width (pixels). Height is derived from device aspect.
const THUMB_W = 60;

export function SlideThumb({
  slide,
  slides,
  index,
  active,
  device,
  orientation,
  theme,
  locale,
  appName,
  appIcon,
  connectedCanvas,
  onSelect,
  onDelete,
  onDuplicate,
}: Props) {
  const headline = pickText(slide.headline, locale);
  const label = pickText(slide.label, locale);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
  });

  const { cW, cH } = getCanvas(device, orientation);
  const aspect = cW / cH;
  const tileH = Math.max(34, Math.min(120, Math.round(THUMB_W / aspect)));
  // Fitted to the tile the clamps actually produced, not to `THUMB_W` alone.
  // The iPhone's 1320x2868 wants 130.4px of height in a 120px tile, and the tile
  // clips — so the bottom 8%, which is exactly where `hero` and `device-bottom`
  // put the phone, was cropped out of every iPhone thumbnail.
  const scale = Math.min(THUMB_W / cW, tileH / cH);
  // Centres what is now narrower than the tile, on top of the connected-canvas
  // offset that scrolls the neighbouring slides into view.
  const inset = (THUMB_W - cW * scale) / 2;
  const start = connectedCanvas ? Math.max(0, index - 1) : index;
  const visibleSlides = connectedCanvas ? slides.slice(start, Math.min(slides.length, index + 2)) : [slide];
  const localIndex = index - start;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-stretch gap-2 rounded-lg border bg-card p-1.5 transition-all hover:border-foreground/30 hover:bg-accent",
        active && "border-primary ring-1 ring-primary",
      )}
    >
      <button
        type="button"
        className="flex w-3 cursor-grab items-center justify-center text-muted-foreground/60 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label={`Reorder screen ${index + 1} (press space, then arrow keys)`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 items-center gap-3 overflow-hidden text-left"
      >
        <div
          aria-hidden
          className="relative shrink-0 overflow-hidden rounded border bg-muted"
          style={{ width: THUMB_W, height: tileH }}
        >
          <div
            style={{
              width: cW * visibleSlides.length,
              height: cH,
              position: "absolute",
              top: 0,
              left: inset - localIndex * cW * scale,
              transformOrigin: "top left",
              transform: `scale(${scale})`,
              pointerEvents: "none",
            }}
          >
            <DeckCanvas
              slides={visibleSlides}
              device={device}
              orientation={orientation}
              theme={theme}
              locale={locale}
              appName={appName}
              appIcon={appIcon}
              connectedCanvas={connectedCanvas}
              editable={false}
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
            {`Screen ${index + 1} · ${LAYOUT_LABEL[slide.layout]}`}
          </span>
          <span className="truncate text-sm font-medium leading-tight">
            {headline.split("\n")[0] || (
              <em className="font-normal text-muted-foreground">Untitled</em>
            )}
          </span>
          {label ? (
            <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
          ) : null}
        </div>
      </button>

      {/* Always visible on touch (no hover); fades in on hover on desktop. */}
      <div className="flex flex-col items-center justify-center gap-0.5 opacity-60 transition-opacity focus-within:opacity-100 group-hover:opacity-100 md:opacity-0">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={onDuplicate}
          aria-label={`Duplicate screen ${index + 1}`}
          title="Duplicate screen"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 hover:text-destructive"
          onClick={onDelete}
          aria-label={`Delete screen ${index + 1}`}
          title="Delete screen (undoable)"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
