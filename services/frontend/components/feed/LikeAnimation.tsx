'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DotLottieReact, type DotLottie } from '@lottiefiles/dotlottie-react';

export type AnchorPoint = { top: number; left: number };

const FALLBACK_TIMEOUT_MS = 2500; // safety net if `complete` never fires

export function LikeAnimation({
  anchorPoint,
  onDone,
}: {
  anchorPoint: AnchorPoint;
  onDone: () => void;
}) {
  const dotLottieRef = useRef<DotLottie | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const fireOnceRef = useRef(false);
  const fireDone = useCallback(() => {
    if (fireOnceRef.current) return; // guard against complete + fallback both firing
    fireOnceRef.current = true;
    doneRef.current();
  }, []);

  const refCallback = useCallback((instance: DotLottie | null) => {
    dotLottieRef.current = instance;
    if (!instance) return;

    instance.addEventListener('complete', fireDone);
    // this instance is torn down entirely on unmount — no removeEventListener
    // needed, since the whole component (and instance) disappears with it.
  }, [fireDone]);

  // fallback: if `complete` never fires (some player versions occasionally
  // drop it), force cleanup after a fixed timeout so it can never get stuck.
  useEffect(() => {
    const timer = setTimeout(fireDone, FALLBACK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fireDone]);

  return createPortal(
    <div
      style={{
        position: 'absolute',
        top: anchorPoint.top,
        left: anchorPoint.left,
        width: 220,
        height: 220,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      <DotLottieReact
        src="https://lottie.host/9f0ae285-0974-46c2-927c-c66b7ea08304/i2kn00wKcW.lottie"
        autoplay
        loop={false}
        dotLottieRefCallback={refCallback}
        style={{ width: '100%', height: '100%' }}
      />
    </div>,
    document.body
  );
}