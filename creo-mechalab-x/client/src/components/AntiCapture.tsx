import AntiCapture from 'react-anticapture';
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type ReactNode, type SyntheticEvent } from 'react';

interface ReactAntiCaptureProps {
  children: ReactNode;
  className?: string;
  title?: string;
  message?: string;
}

const CAPTURE_BLOCK_MS = 2200;
const CAPTURE_SHORTCUT_BLOCK_MS = 15000;
const MOBILE_CAPTURE_GESTURE_TOUCHES = 3;

const captureHintPressed = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase();
  const isPrintScreen = key === 'printscreen' || key === 'snapshot';
  const isWindowsSnip = (event.ctrlKey || event.metaKey) && event.shiftKey && key === 's';
  const isMacScreenCapture = event.metaKey && event.shiftKey && ['3', '4', '5'].includes(key);

  return isPrintScreen || isWindowsSnip || isMacScreenCapture;
};

export default function ReactAntiCapture({
  children,
  className = '',
  title = 'Screen capture blocked',
  message = 'This module view is protected.',
}: ReactAntiCaptureProps) {
  const [isShieldVisible, setIsShieldVisible] = useState(false);
  const [isFocusBlocked, setIsFocusBlocked] = useState(false);
  const [isLibraryBlurred, setIsLibraryBlurred] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const releaseLibraryBlur = useCallback(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    document.documentElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, []);

  const clearShieldTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const showShield = useCallback((durationMs = CAPTURE_BLOCK_MS) => {
    setIsShieldVisible(true);
    clearShieldTimer();
    timeoutRef.current = window.setTimeout(() => {
      setIsShieldVisible(false);
      releaseLibraryBlur();
      timeoutRef.current = null;
    }, durationMs);
  }, [clearShieldTimer, releaseLibraryBlur]);

  useEffect(() => {
    const unlockTimer = window.setTimeout(() => {
      releaseLibraryBlur();
    }, 120);

    return () => window.clearTimeout(unlockTimer);
  }, [releaseLibraryBlur]);

  useEffect(() => {
    const rootNode = rootRef.current;
    if (!rootNode) return;

    const syncLibraryBlurState = () => {
      const isBlurred = rootNode.querySelector('._anticapture-blur-page_o02wf_61') !== null;
      setIsLibraryBlurred((current) => (current === isBlurred ? current : isBlurred));
    };

    syncLibraryBlurState();

    const observer = new MutationObserver(() => {
      syncLibraryBlurState();
    });

    observer.observe(rootNode, {
      attributes: true,
      subtree: true,
      childList: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!captureHintPressed(event)) return;
      event.preventDefault();
      event.stopPropagation();
      showShield(CAPTURE_SHORTCUT_BLOCK_MS);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length < MOBILE_CAPTURE_GESTURE_TOUCHES) return;
      showShield(CAPTURE_SHORTCUT_BLOCK_MS);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsFocusBlocked(true);
        showShield();
        return;
      }

      window.setTimeout(() => {
        setIsFocusBlocked(false);
      }, 180);
    };

    const handleWindowBlur = () => {
      setIsFocusBlocked(true);
      showShield(2600);
    };

    const handleWindowFocus = () => {
      window.setTimeout(() => {
        setIsFocusBlocked(false);
      }, 180);
    };

    const handleBeforePrint = () => {
      setIsFocusBlocked(true);
      showShield(2600);
    };

    const handleAfterPrint = () => {
      setIsFocusBlocked(false);
    };

    const handlePageHide = () => {
      setIsFocusBlocked(true);
      showShield(2600);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('touchstart', handleTouchStart, true);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearShieldTimer();
    };
  }, [clearShieldTimer, showShield]);

  const preventCaptureInteractions = (event: SyntheticEvent | ClipboardEvent | DragEvent) => {
    event.preventDefault();
    showShield(1400);
  };

  return (
    <div
      ref={rootRef}
      className={`relative overflow-hidden ${className}`}
      onContextMenu={preventCaptureInteractions}
      onCopy={preventCaptureInteractions}
      onCut={preventCaptureInteractions}
      onDragStart={preventCaptureInteractions}
      onPointerDownCapture={() => {
        if (!isShieldVisible && !isFocusBlocked) {
          releaseLibraryBlur();
        }
      }}
    >
      <style>{`
        :fullscreen,
        :-webkit-full-screen,
        :-moz-full-screen {
          background-color: transparent !important;
        }

        ._anticapture-wrapper_o02wf_15 {
          position: relative;
        }

        ._alert-anticapture_o02wf_23 {
          display: none !important;
        }

        ._anticapture-blur-page_o02wf_61 {
          filter: blur(6px);
          pointer-events: none;
        }

        .react-anti-capture-content,
        .react-anti-capture-content * {
          -webkit-touch-callout: none !important;
          -webkit-user-select: none !important;
          user-select: none !important;
          -webkit-user-drag: none !important;
        }

        @media print {
          ._anticapture-wrapper_o02wf_15,
          ._alert-anticapture_o02wf_23,
          ._anticapture-blur-page_o02wf_61 {
            display: none !important;
          }

          .react-anti-capture-content {
            visibility: hidden !important;
          }
          .react-anti-capture-print-shield {
            display: flex !important;
            position: fixed !important;
            inset: 0 !important;
            z-index: 9999 !important;
            align-items: center !important;
            justify-content: center !important;
            background: #020617 !important;
            color: white !important;
          }
        }
      `}</style>
      <div
        aria-hidden={isShieldVisible || isFocusBlocked || isLibraryBlurred}
        className={`react-anti-capture-content transition duration-150 ${(isShieldVisible || isFocusBlocked || isLibraryBlurred) ? 'pointer-events-none select-none blur-md brightness-50' : ''}`}
      >
        <AntiCapture
          screenshotPrevent
          clipboardPrevent
          userSelect={false}
        >
          {children}
        </AntiCapture>
      </div>

      {(isShieldVisible || isFocusBlocked || isLibraryBlurred) ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/92 backdrop-blur-sm">
          <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/95 px-6 py-5 text-center shadow-2xl">
            <p className="text-lg font-black text-white">{title}</p>
            <p className="mt-2 text-sm text-slate-300">{message}</p>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-10 opacity-[0.08] [background-image:repeating-linear-gradient(-25deg,transparent_0_24px,rgba(255,255,255,0.7)_24px_25px)]" />
      <div className="react-anti-capture-print-shield hidden">
        <div className="rounded-2xl border border-cyan-500/30 bg-slate-900 px-6 py-5 text-center shadow-2xl">
          <p className="text-lg font-black">{title}</p>
          <p className="mt-2 text-sm text-slate-300">{message}</p>
        </div>
      </div>
    </div>
  );
}
