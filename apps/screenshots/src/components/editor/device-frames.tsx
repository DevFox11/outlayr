"use client";
import * as React from "react";
import { FRAME_ASPECT, PHONE_SCREEN } from "@/lib/constants";
import { img } from "@/lib/image-cache";

type FrameProps = {
  src: string;
  style?: React.CSSProperties;
  /** When true, hide EmptySlot placeholder (so it doesn't bake into exports). */
  hideEmpty?: boolean;
};

// iPhone — uses pre-measured mockup.png overlay
export function Phone({ src, style, hideEmpty }: FrameProps) {
  const resolved = img(src);
  return (
    <div style={{ position: "relative", aspectRatio: FRAME_ASPECT.iphone, ...style }}>
      <img
        src={img("/mockup.png")}
        alt=""
        style={{ display: "block", width: "100%", height: "100%" }}
        draggable={false}
      />
      <div
        style={{
          position: "absolute",
          zIndex: 10,
          overflow: "hidden",
          left: `${PHONE_SCREEN.L}%`,
          top: `${PHONE_SCREEN.T}%`,
          width: `${PHONE_SCREEN.W}%`,
          height: `${PHONE_SCREEN.H}%`,
          borderRadius: `${PHONE_SCREEN.RX}% / ${PHONE_SCREEN.RY}%`,
          background: "#111",
        }}
      >
        {resolved ? (
          <img
            src={resolved}
            alt=""
            style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
            draggable={false}
          />
        ) : hideEmpty ? null : (
          <EmptySlot />
        )}
      </div>
    </div>
  );
}

type BezelSpec = {
  aspectRatio: number;
  /** The outer shell: corner radius, gradient and shadow. */
  body: React.CSSProperties;
  /** The camera dot, positioned against the shell. */
  dot: React.CSSProperties;
  /** The cutout the screenshot fills. */
  screen: React.CSSProperties;
};

function Bezel({ spec, src, style, hideEmpty }: { spec: BezelSpec } & FrameProps) {
  const resolved = img(src);
  return (
    <div style={{ position: "relative", aspectRatio: spec.aspectRatio, ...style }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          ...spec.body,
        }}
      >
        <div style={{ position: "absolute", borderRadius: "50%", zIndex: 20, ...spec.dot }} />
        <div style={{ position: "absolute", overflow: "hidden", background: "#000", ...spec.screen }}>
          {resolved ? (
            <img
              src={resolved}
              alt=""
              style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
              draggable={false}
            />
          ) : hideEmpty ? null : (
            <EmptySlot />
          )}
        </div>
      </div>
    </div>
  );
}

const ANDROID_PHONE: BezelSpec = {
  aspectRatio: FRAME_ASPECT.android,
  body: {
    borderRadius: "8% / 4%",
    background: "linear-gradient(160deg, #2a2a2e 0%, #18181b 100%)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 8px 40px rgba(0,0,0,0.55)",
  },
  dot: {
    top: "1.5%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "3%",
    height: "1.4%",
    background: "#0d0d0f",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  screen: { left: "3.5%", top: "2%", width: "93%", height: "96%", borderRadius: "5.5% / 2.6%" },
};

const ANDROID_TABLET_PORTRAIT: BezelSpec = {
  aspectRatio: FRAME_ASPECT.tabletPortrait,
  body: {
    borderRadius: "4.5% / 2.8%",
    background: "linear-gradient(160deg, #2a2a2e 0%, #18181b 100%)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 8px 48px rgba(0,0,0,0.6)",
  },
  dot: {
    top: "1.2%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "1.4%",
    height: "0.88%",
    background: "#0d0d0f",
  },
  screen: { left: "3.5%", top: "2.2%", width: "93%", height: "95.6%", borderRadius: "2.5% / 1.6%" },
};

const ANDROID_TABLET_LANDSCAPE: BezelSpec = {
  aspectRatio: FRAME_ASPECT.tabletLandscape,
  body: {
    borderRadius: "2.8% / 4.5%",
    background: "linear-gradient(160deg, #2a2a2e 0%, #18181b 100%)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 8px 48px rgba(0,0,0,0.6)",
  },
  dot: {
    left: "1.2%",
    top: "50%",
    transform: "translateY(-50%)",
    width: "0.88%",
    height: "1.4%",
    background: "#0d0d0f",
  },
  screen: { left: "2.2%", top: "3.5%", width: "95.6%", height: "93%", borderRadius: "1.6% / 2.5%" },
};

const IPAD: BezelSpec = {
  aspectRatio: FRAME_ASPECT.ipad,
  body: {
    borderRadius: "5% / 3.6%",
    background: "linear-gradient(180deg, #2C2C2E 0%, #1C1C1E 100%)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1), 0 8px 40px rgba(0,0,0,0.6)",
  },
  dot: {
    top: "1.2%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "0.9%",
    height: "0.65%",
    background: "#111113",
  },
  screen: { left: "4%", top: "2.8%", width: "92%", height: "94.4%", borderRadius: "2.2% / 1.6%" },
};

export function AndroidPhone(props: FrameProps) {
  return <Bezel spec={ANDROID_PHONE} {...props} />;
}

export function AndroidTabletP(props: FrameProps) {
  return <Bezel spec={ANDROID_TABLET_PORTRAIT} {...props} />;
}

export function AndroidTabletL(props: FrameProps) {
  return <Bezel spec={ANDROID_TABLET_LANDSCAPE} {...props} />;
}

export function IPad(props: FrameProps) {
  return <Bezel spec={IPAD} {...props} />;
}

function EmptySlot() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.4)",
        fontSize: "min(2vw, 14px)",
        background: "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)",
        textAlign: "center",
        padding: "4%",
      }}
    >
      Drop a screenshot here
    </div>
  );
}
