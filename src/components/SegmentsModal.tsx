import React, { useState } from "react";
import { X, Check, Pause, Play, FolderOpen } from "lucide-react";
import { DownloadItem } from "../types";
import { translations } from "../i18n";

interface DownloadDetailModalProps {
  item: DownloadItem | null;
  onClose: () => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onOpenFolder: (path: string) => void;
  lang: "tr" | "en";
}

export const SegmentsModal: React.FC<DownloadDetailModalProps> = ({
  item,
  onClose,
  onPause,
  onResume,
  onCancel,
  onOpenFolder,
  lang,
}) => {
  const [showDetails, setShowDetails] = useState(true);
  const [autoClose, setAutoClose] = useState(false);
  const t = translations[lang];

  React.useEffect(() => {
    if (autoClose && item && item.state === "completed") {
      const timer = setTimeout(() => {
        onClose();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoClose, item?.state, onClose]);

  if (!item) return null;

  const pct = item.totalBytes > 0
    ? Math.min(100, Math.round((item.receivedBytes / item.totalBytes) * 100))
    : 0;

  const formatSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2).replace(".", ",") + " GB";
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (!bytesPerSec || bytesPerSec <= 0) return "—";
    if (bytesPerSec < 1024) return bytesPerSec.toFixed(0) + " B/s";
    if (bytesPerSec < 1024 * 1024) return (bytesPerSec / 1024).toFixed(1).replace(".", ",") + " KB/s";
    return (bytesPerSec / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB/s";
  };

  const formatTimeLeft = () => {
    if (item.state !== "downloading" || item.speed <= 0 || item.totalBytes <= 0) return "—";
    const remainingBytes = item.totalBytes - item.receivedBytes;
    if (remainingBytes <= 0) return "—";
    const seconds = Math.ceil(remainingBytes / item.speed);
    if (seconds < 60) return `${seconds} s`;
    const minutes = Math.floor(seconds / 60);
    const remSec = seconds % 60;
    return `${minutes} m ${remSec} s`;
  };

  // Generate segments display with full support for concurrent multi-source download
  const displaySegments = item.segments && item.segments.length > 0
    ? item.segments.map((s, i) => {
        const rec = s.received ?? (s as any).downloaded ?? 0;
        const chunkLen = s.end > s.start ? s.end - s.start + 1 : 1;
        return {
          index: i,
          start: s.start || 0,
          end: s.end || 0,
          received: rec,
          active: s.active ?? (item.state === "downloading" && rec < chunkLen),
        };
      })
    : Array.from({ length: 8 }, (_, i) => {
        const segCount = 8;
        const chunkSize = item.totalBytes > 0 ? Math.floor(item.totalBytes / segCount) : 0;
        const start = i * chunkSize;
        const end = i === segCount - 1 ? (item.totalBytes || 1) - 1 : (i + 1) * chunkSize - 1;
        const segLen = Math.max(1, end - start + 1);
        const baseRec = item.totalBytes > 0
          ? Math.min(segLen, Math.floor((item.receivedBytes / item.totalBytes) * segLen))
          : Math.floor(item.receivedBytes / segCount);
        return {
          index: i,
          start,
          end,
          received: baseRec,
          active: item.state === "downloading" && baseRec < segLen,
        };
      });

  return (
    <div className="fixed inset-0 modal-perde backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#24272d] border border-[#3b424e] rounded-xl shadow-2xl w-full max-w-xl text-[#d4d8e2] text-[13px] font-sans overflow-hidden">
        {/* macOS style Window Header */}
        <div className="h-9 px-4 bg-[#1e2126] border-b border-[#323843] flex items-center justify-between select-none">
          <div className="flex items-center space-x-2">
            <span className="font-mono text-xs text-[#8e95a5] font-semibold">{pct}%</span>
            <span className="text-[#626875]">·</span>
            <span className="font-medium text-xs text-white truncate max-w-xs">{item.fileName}</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#8e95a5] hover:text-white p-1 rounded hover:bg-[#343a46] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Two-Column Info Grid matching docs/detail.png */}
          <div className="grid grid-cols-12 gap-y-2 text-xs">
            <div className="col-span-3 text-[#8e95a5]">{t.detail.url}</div>
            <div className="col-span-9 font-mono text-[#c0c5d1] truncate select-all">{item.url}</div>

            <div className="col-span-3 text-[#8e95a5]">{t.detail.status}</div>
            <div className="col-span-9 font-medium">
              <span
                className={
                  item.state === "completed"
                    ? "text-[#a2d8a2]"
                    : item.state === "downloading"
                    ? "text-[#62a4f8]"
                    : item.state === "failed"
                    ? "text-[#f87171]"
                    : "text-[#8e95a5]"
                }
              >
                {item.state === "downloading" ? t.detail.receivingData : t.status[item.state]}
              </span>
            </div>

            <div className="col-span-3 text-[#8e95a5]">{t.detail.fileSize}</div>
            <div className="col-span-9 font-mono text-[#c0c5d1]">{formatSize(item.totalBytes)}</div>

            <div className="col-span-3 text-[#8e95a5]">{t.detail.downloaded}</div>
            <div className="col-span-9 font-mono text-[#c0c5d1]">
              {formatSize(item.receivedBytes)} ({pct}%)
            </div>

            <div className="col-span-3 text-[#8e95a5]">{t.detail.transferRate}</div>
            <div className="col-span-9 font-mono text-[#c0c5d1]">{formatSpeed(item.speed)}</div>

            <div className="col-span-3 text-[#8e95a5]">{t.detail.timeLeft}</div>
            <div className="col-span-9 font-mono text-[#c0c5d1]">{formatTimeLeft()}</div>

            <div className="col-span-3 text-[#8e95a5]">{t.detail.resumeCapability}</div>
            <div className="col-span-9 text-[#c0c5d1]">
              {item.supportsRanges || item.totalBytes > 0 ? t.detail.yes : t.detail.no}
            </div>

            <div className="col-span-3 text-[#8e95a5]">{t.detail.saveTo}</div>
            <div className="col-span-9 font-mono text-[#8e95a5] truncate select-all">{item.savePath}</div>
          </div>

          {/* Primary Progress Bar */}
          <div className="w-full bg-[#16181b] h-3 rounded-full overflow-hidden border border-[#363c48]">
            <div
              className="bg-[#2f6feb] h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="px-2.5 py-1 text-xs bg-[#2d323b] hover:bg-[#383e4a] text-[#cfd3dc] rounded border border-[#3b424e] transition-colors"
              >
                {showDetails ? t.detail.hideDetails : t.detail.showDetails}
              </button>

              <label className="flex items-center space-x-1.5 text-xs text-[#8e95a5] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoClose}
                  onChange={(e) => setAutoClose(e.target.checked)}
                  className="rounded bg-[#1e2126] border-[#3b424e] text-blue-600 focus:ring-0"
                />
                <span>{t.detail.closeWhenCompleted}</span>
              </label>
            </div>

            <div className="flex items-center space-x-2">
              {item.state === "downloading" ? (
                <button
                  onClick={() => onPause(item.id)}
                  className="px-3 py-1 text-xs bg-[#2d323b] hover:bg-[#383e4a] text-white rounded border border-[#3b424e] transition-colors font-medium"
                >
                  {t.detail.pause}
                </button>
              ) : item.state === "paused" ? (
                <button
                  onClick={() => onResume(item.id)}
                  className="px-3 py-1 text-xs bg-[#2f6feb] hover:bg-[#255ec4] text-white rounded border border-[#3b75f2] transition-colors font-medium"
                >
                  {t.detail.resume}
                </button>
              ) : null}

              {item.state === "completed" ? (
                <button
                  onClick={() => onOpenFolder(item.savePath)}
                  className="px-3 py-1 text-xs bg-[#2d323b] hover:bg-[#383e4a] text-white rounded border border-[#3b424e] transition-colors font-medium"
                >
                  {t.detail.showInFolder}
                </button>
              ) : (
                <button
                  onClick={() => onCancel(item.id)}
                  className="px-3 py-1 text-xs bg-[#2d323b] hover:bg-[#383e4a] text-[#cfd3dc] rounded border border-[#3b424e] transition-colors"
                >
                  {t.detail.cancel}
                </button>
              )}
            </div>
          </div>

          {/* Details Section (Connection Segment Bar & Table) */}
          {showDetails && (
            <div className="border-t border-[#323843] pt-4 space-y-3">
              <div className="text-center text-[11px] text-[#8e95a5] font-medium tracking-wide">
                {t.detail.connectionsTitle}
              </div>

              {/* IDM Segment Visualizer Bar matching docs/detail.png */}
              <div className="w-full bg-[#181a1e] h-3 rounded flex overflow-hidden border border-[#343a46] p-0.5 space-x-0.5">
                {displaySegments.map((seg, i) => {
                  const chunkLen = seg.end > seg.start ? seg.end - seg.start : 1;
                  const segPct = Math.min(100, Math.round((seg.received / chunkLen) * 100));
                  return (
                    <div key={i} className="flex-1 bg-[#252931] h-full rounded-sm overflow-hidden">
                      <div
                        className="bg-[#2f6feb] h-full transition-all duration-300"
                        style={{ width: `${segPct}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Connections Table */}
              <div className="bg-[#1b1e23] border border-[#323843] rounded-md overflow-hidden text-xs">
                <div className="grid grid-cols-12 bg-[#212429] border-b border-[#323843] text-[#8e95a5] font-medium px-3 py-1">
                  <div className="col-span-1">{t.detail.colN}</div>
                  <div className="col-span-3">{t.detail.colDownloaded}</div>
                  <div className="col-span-3">{t.detail.colStart}</div>
                  <div className="col-span-5">{t.detail.colInfo}</div>
                </div>

                <div className="max-h-36 overflow-y-auto divide-y divide-[#282c35]">
                  {displaySegments.map((seg, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 px-3 py-1.5 font-mono text-[11px] text-[#c0c5d1] items-center hover:bg-[#252931]"
                    >
                      <div className="col-span-1 text-[#8e95a5] font-sans">{idx + 1}</div>
                      <div className="col-span-3">{formatSize(seg.received)}</div>
                      <div className="col-span-3">{formatSize(seg.start)}</div>
                      <div className="col-span-5 font-sans">
                        {item.state === "completed" ? (
                          <span className="text-[#a2d8a2]">{t.status.completed}</span>
                        ) : seg.active ? (
                          <span className="text-[#62a4f8]">{t.detail.receivingData}</span>
                        ) : seg.received > 0 ? (
                          <span className="text-[#8e95a5]">{t.detail.standby}</span>
                        ) : (
                          <span className="text-[#626875]">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
