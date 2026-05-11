import { X } from "lucide-react";
import { KeyboardEvent, useEffect, useState } from "react";

import { apiBlob } from "../lib/api";

export function PhotoPreview({ submissionId }: { readonly submissionId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setFailed(false);
    setIsOpen(false);

    void apiBlob(`/api/submissions/photos/${submissionId}`)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setUrl(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [submissionId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function handlePreviewKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Enter") {
      setIsOpen(true);
    }
  }

  if (failed) {
    return (
      <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50 px-3 text-center text-xs font-semibold text-red-700">
        Photo unavailable
      </div>
    );
  }

  if (!url) {
    return <div className="h-28 rounded-lg border border-dashed border-gray-300 bg-slate-50" />;
  }

  return (
    <>
      <div
        className="h-28 w-full cursor-zoom-in overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
        onDoubleClick={() => setIsOpen(true)}
        onKeyDown={handlePreviewKeyDown}
        role="button"
        tabIndex={0}
        title="Double-click to enlarge"
      >
        <img src={url} alt="Submission" className="h-full w-full object-cover" draggable={false} />
      </div>

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setIsOpen(false)}
          role="dialog"
        >
          <div className="relative max-h-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button className="absolute right-3 top-3 rounded-full bg-white/95 p-2 text-slate-900 shadow-lg transition hover:bg-white" onClick={() => setIsOpen(false)} type="button">
              <X size={20} />
              <span className="sr-only">Close photo preview</span>
            </button>
            <img src={url} alt="Submission enlarged" className="max-h-[90vh] max-w-full rounded-lg bg-white object-contain shadow-2xl" draggable={false} />
          </div>
        </div>
      ) : null}
    </>
  );
}
