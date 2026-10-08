// Full-window viewer for an image or video from a chat. Esc or a click on the
// backdrop closes it.
import { ExternalLink, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { openExternal } from "./openExternal";
import { type Save, saveIcon, saveLabel, saveTitle } from "./useSave";

export function Lightbox({
  kind,
  src,
  name,
  startAt = 0,
  save,
  onClose,
}: {
  kind: "image" | "video";
  src: string;
  name: string;
  /** Video: where the inline player was, so playback continues. */
  startAt?: number;
  save?: Save;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canOpen = /^https?:/i.test(src);
  const SaveIcon = save && saveIcon(save);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={onClose}
      className="animate-fade fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm motion-reduce:animate-none"
    >
      <div className="flex h-12 shrink-0 items-center gap-2 px-4 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/85">{name}</span>
        {save && SaveIcon && (
          <button
            onClick={save.run}
            disabled={save.status === "saving"}
            title={saveTitle(save)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white/80 transition hover:bg-white/10 hover:text-white ${save.status === "saving" ? "animate-pulse" : ""}`}
          >
            <SaveIcon size={13} /> {saveLabel(save)}
          </button>
        )}
        {canOpen && (
          <button
            onClick={() => openExternal(src)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <ExternalLink size={13} /> Open in browser
          </button>
        )}
        <button
          onClick={onClose}
          aria-label="Close"
          title="Close (Esc)"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 pb-8">
        {kind === "image" ? (
          <img
            src={src}
            alt={name}
            onClick={(e) => e.stopPropagation()}
            className="animate-pop h-full w-full select-none object-contain drop-shadow-2xl motion-reduce:animate-none"
            draggable={false}
          />
        ) : (
          <video
            ref={videoRef}
            src={src}
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
            onLoadedMetadata={() => {
              if (startAt && videoRef.current) videoRef.current.currentTime = startAt;
            }}
            className="animate-pop max-h-full max-w-full rounded-lg bg-black shadow-2xl motion-reduce:animate-none"
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
