import React, { useState, useEffect, useRef } from "react";
import { ConfirmModal } from "./ConfirmModal";
import {
  FileText,
  Image as ImageIcon,
  Music,
  Film,
  LayoutGrid,
  Archive,
  File,
  Pause,
  Play,
  Trash2,
  FolderOpen,
  Info,
  ExternalLink,
  Copy,
  RotateCw,
  FileDown,
} from "lucide-react";
import { DownloadItem, FileCategory } from "../types";
import { translations } from "../i18n";

// Size, status and speed columns are resizable; the name column takes the remaining width.
type ColumnWidths = { size: number; status: number; speed: number };
const DEFAULT_WIDTHS: ColumnWidths = { size: 160, status: 140, speed: 190 };
const MIN_WIDTHS: ColumnWidths = { size: 90, status: 90, speed: 150 };
const NAME_MIN_WIDTH = 180;
const WIDTHS_KEY = "tarus-dm-column-widths";

function loadWidths(): ColumnWidths {
  try {
    const saved = JSON.parse(localStorage.getItem(WIDTHS_KEY) || "null");
    if (saved && typeof saved === "object") {
      const w = { ...DEFAULT_WIDTHS };
      for (const k of Object.keys(w) as (keyof ColumnWidths)[]) {
        if (typeof saved[k] === "number") w[k] = Math.max(MIN_WIDTHS[k], saved[k]);
      }
      return w;
    }
  } catch {}
  return { ...DEFAULT_WIDTHS };
}

interface DownloadTableProps {
  items: DownloadItem[];
  lang: "tr" | "en";
  selectedIds: string[];
  onSelectIds: (ids: string[]) => void;
  onOpenDetail: (item: DownloadItem) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string, deleteFile?: boolean) => void;
  onOpenFolder: (path: string) => void;
  onOpenFile?: (path: string) => void;
  onRedownload?: (item: DownloadItem) => void;
}

export const DownloadTable: React.FC<DownloadTableProps> = ({
  items,
  lang,
  selectedIds,
  onSelectIds,
  onOpenDetail,
  onPause,
  onResume,
  onCancel,
  onDelete,
  onOpenFolder,
  onOpenFile,
  onRedownload,
}) => {
  const t = translations[lang];

  const [deleteFileTarget, setDeleteFileTarget] = useState<string | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    item: DownloadItem | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    item: null,
  });

  const menuRef = useRef<HTMLDivElement>(null);

  const [widths, setWidths] = useState<ColumnWidths>(loadWidths);
  const tableRef = useRef<HTMLDivElement>(null);
  const gridTemplateColumns = `minmax(${NAME_MIN_WIDTH}px, 1fr) ${widths.size}px ${widths.status}px ${widths.speed}px`;

  useEffect(() => {
    try { localStorage.setItem(WIDTHS_KEY, JSON.stringify(widths)); } catch {}
  }, [widths]);

  // Drag the border to the left of `column`: the border follows the pointer, so that column and its
  // left neighbour trade width (the name column on the far left simply absorbs the difference).
  const startResize = (column: keyof ColumnWidths, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const start = { ...widths };
    const left: keyof ColumnWidths | null = column === "status" ? "size" : column === "speed" ? "status" : null;
    const tableWidth = tableRef.current?.clientWidth ?? Infinity;
    const onMove = (ev: PointerEvent) => {
      let dx = ev.clientX - startX;
      // Keep both sides of the border above their minimum width.
      dx = Math.min(dx, start[column] - MIN_WIDTHS[column]);
      if (left) dx = Math.max(dx, MIN_WIDTHS[left] - start[left]);
      else dx = Math.max(dx, NAME_MIN_WIDTH + start.size + start.status + start.speed + 32 - tableWidth);
      const next = { ...start, [column]: start[column] - dx };
      if (left) next[left] = start[left] + dx;
      setWidths(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const resizeHandle = (column: keyof ColumnWidths) => (
    <div
      role="separator"
      aria-orientation="vertical"
      title={t.table.resizeHint}
      onPointerDown={(e) => startResize(column, e)}
      onDoubleClick={() => setWidths({ ...DEFAULT_WIDTHS })}
      className="absolute -left-[3px] top-0 h-full w-[6px] cursor-col-resize z-10 group/handle"
    >
      <div className="mx-auto h-full w-px bg-n2d323b group-hover/handle:bg-[#3b82f6] group-hover/handle:w-0.5" />
    </div>
  );

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const formatSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return "-";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2).replace(".", ",") + " GB";
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (!bytesPerSec || bytesPerSec <= 0) return "";
    if (bytesPerSec < 1024) return bytesPerSec.toFixed(0) + " B/s";
    if (bytesPerSec < 1024 * 1024) return (bytesPerSec / 1024).toFixed(1).replace(".", ",") + " KB/s";
    return (bytesPerSec / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB/s";
  };

  const getCategoryIcon = (category: FileCategory) => {
    switch (category) {
      case "image": return <ImageIcon size={18} className="text-n8e95a5" />;
      case "music": return <Music size={18} className="text-n8e95a5" />;
      case "video": return <Film size={18} className="text-n8e95a5" />;
      case "apps": return <LayoutGrid size={18} className="text-n8e95a5" />;
      case "document": return <FileText size={18} className="text-n8e95a5" />;
      case "compressed": return <Archive size={18} className="text-n8e95a5" />;
      default: return <File size={18} className="text-n8e95a5" />;
    }
  };

  const getCategoryLabel = (cat: FileCategory) => {
    switch (cat) {
      case "image": return t.sidebar.image;
      case "music": return t.sidebar.music;
      case "video": return t.sidebar.video;
      case "apps": return t.sidebar.apps;
      case "document": return t.sidebar.document;
      case "compressed": return t.sidebar.compressed;
      default: return t.sidebar.other;
    }
  };

  const getStatusLabel = (item: DownloadItem) => {
    if (item.state === "downloading") {
      const pct = item.totalBytes > 0
        ? Math.round((item.receivedBytes / item.totalBytes) * 100)
        : 0;
      return pct > 0 ? `${t.status.downloading} (${pct}%)` : t.status.downloading;
    }
    return t.status[item.state] || item.state;
  };

  // Row selection handler supporting Multi-Select (Shift / Ctrl / Cmd)
  const handleRowClick = (item: DownloadItem, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      if (selectedIds.includes(item.id)) {
        onSelectIds(selectedIds.filter((id) => id !== item.id));
      } else {
        onSelectIds([...selectedIds, item.id]);
      }
    } else if (e.shiftKey && selectedIds.length > 0) {
      // Range selection
      const lastSelectedId = selectedIds[selectedIds.length - 1];
      const lastIndex = items.findIndex((i) => i.id === lastSelectedId);
      const currentIndex = items.findIndex((i) => i.id === item.id);
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeIds = items.slice(start, end + 1).map((i) => i.id);
        const newSet = new Set([...selectedIds, ...rangeIds]);
        onSelectIds(Array.from(newSet));
      } else {
        onSelectIds([item.id]);
      }
    } else {
      // Single selection
      onSelectIds([item.id]);
    }
  };

  // Right-Click Context Menu Trigger
  const handleContextMenu = (item: DownloadItem, e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedIds.includes(item.id)) {
      onSelectIds([item.id]);
    }
    setContextMenu({
      visible: true,
      x: Math.min(window.innerWidth - 220, e.clientX),
      y: Math.min(window.innerHeight - 300, e.clientY),
      item,
    });
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  return (
    <div
      ref={tableRef}
      className="flex-1 flex flex-col overflow-hidden bg-n181a1e select-none text-nd6d9e0 text-[13px] relative"
      onContextMenu={(e) => {
        // Prevent default browser menu if clicking background
        if ((e.target as HTMLElement).tagName !== "INPUT") {
          e.preventDefault();
        }
      }}
    >
      {/* Table Header */}
      <div
        className="h-7 bg-n212429 border-b border-n2d323b grid text-n8e95a5 text-xs font-medium px-4 items-center"
        style={{ gridTemplateColumns }}
      >
        <div className="pr-2 truncate">{t.table.name}</div>
        <div className="relative h-full flex items-center px-3 truncate">{resizeHandle("size")}{t.table.size}</div>
        <div className="relative h-full flex items-center px-3 truncate">{resizeHandle("status")}{t.table.status}</div>
        <div className="relative h-full flex items-center px-3 truncate">{resizeHandle("speed")}{t.table.speed}</div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-n6e7687 text-center p-8 space-y-3">
            <FileText size={42} className="opacity-40" />
            <p className="whitespace-pre-line text-sm max-w-sm leading-relaxed">{t.emptyState}</p>
          </div>
        ) : (
          items.map((item, index) => {
            const isSelected = selectedIds.includes(item.id);
            const isZebra = index % 2 === 1;

            return (
              <div
                key={item.id}
                onClick={(e) => handleRowClick(item, e)}
                onDoubleClick={() => onOpenDetail(item)}
                onContextMenu={(e) => handleContextMenu(item, e)}
                style={{ gridTemplateColumns }}
                className={`grid items-center px-4 py-2 border-b border-n212429 cursor-pointer transition-colors group ${
                  isSelected
                    ? "bg-n28395a text-nwhite"
                    : isZebra
                    ? "bg-n1d2025 hover:bg-n252930"
                    : "bg-n181a1e hover:bg-n252930"
                }`}
              >
                {/* Name Column */}
                <div className="flex items-center space-x-3 pr-2 min-w-0">
                  <div className="shrink-0">{getCategoryIcon(item.category)}</div>
                  <div className="min-w-0">
                    <div className="font-medium truncate text-[13px]">{item.fileName}</div>
                    <div className="text-[11px] text-n8e95a5 truncate">
                      {getCategoryLabel(item.category)}
                      {item.state === "downloading" && (
                        <span className="text-[#62a4f8] ml-1.5 font-medium">
                          · {item.segments?.length || 8} Bağlantı
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Size Column */}
                <div className="px-3 min-w-0 font-mono text-[12px] text-nc0c5d1">
                  {item.state === "downloading" ? (
                    <div>
                      <div className="truncate text-[11px]">
                        {item.totalBytes > 0
                          ? `${formatSize(item.receivedBytes)} / ${formatSize(item.totalBytes)}`
                          : formatSize(item.receivedBytes)}
                      </div>
                      {item.totalBytes > 0 && (
                        <div className="w-full bg-n2d323b h-1.5 rounded-full mt-1 overflow-hidden">
                          <div
                            className="bg-[#3b82f6] h-full transition-all duration-300 rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((item.receivedBytes / item.totalBytes) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    formatSize(item.totalBytes > 0 ? item.totalBytes : item.receivedBytes)
                  )}
                </div>

                {/* Status Column */}
                <div className="px-3 min-w-0 truncate text-[12px]">
                  <span
                    className={
                      item.state === "completed"
                        ? "text-[#a2d8a2] font-medium"
                        : item.state === "downloading"
                        ? "text-[#62a4f8] font-medium"
                        : item.state === "failed"
                        ? "text-[#f87171]"
                        : "text-n8e95a5"
                    }
                  >
                    {getStatusLabel(item)}
                  </span>
                </div>

                {/* Speed Column + Actions on Hover */}
                <div className="px-3 flex items-center justify-between min-w-0 font-mono text-[12px] text-nc0c5d1">
                  <span className="truncate text-[#62a4f8] font-semibold">
                    {item.state === "downloading" && item.speed > 0
                      ? formatSpeed(item.speed)
                      : item.state === "downloading"
                      ? "Bağlanıyor..."
                      : ""}
                  </span>

                  {/* Action buttons on hover */}
                  <div className="flex items-center space-x-1 tarus-satir-islem">
                    <button
                      title={t.detail.showDetails}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetail(item);
                      }}
                      className="p-1 hover:text-nwhite text-n8e95a5 rounded hover:bg-n343a46"
                    >
                      <Info size={14} />
                    </button>
                    {item.state === "downloading" ? (
                      <button
                        title={t.detail.pause}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPause(item.id);
                        }}
                        className="p-1 hover:text-nwhite text-n8e95a5 rounded hover:bg-n343a46"
                      >
                        <Pause size={14} />
                      </button>
                    ) : item.state === "paused" || item.state === "failed" ? (
                      <button
                        title={t.detail.resume}
                        onClick={(e) => {
                          e.stopPropagation();
                          onResume(item.id);
                        }}
                        className="p-1 hover:text-nwhite text-n8e95a5 rounded hover:bg-n343a46"
                      >
                        <Play size={14} />
                      </button>
                    ) : null}
                    <button
                      title={t.detail.showInFolder}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenFolder(item.savePath);
                      }}
                      className="p-1 hover:text-nwhite text-n8e95a5 rounded hover:bg-n343a46"
                    >
                      <FolderOpen size={14} />
                    </button>
                    <button
                      title={t.toolbar.clearFinished}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                      className="p-1 hover:text-red-400 text-n8e95a5 rounded hover:bg-n343a46"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modern IDM Context Menu */}
      {contextMenu.visible && contextMenu.item && (
        <div
          ref={menuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 w-56 bg-n212429 border border-n343a46 rounded-lg shadow-2xl py-1 text-xs text-nd6d9e0 font-sans divide-y divide-n2c313a"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Section 1: File Actions */}
          <div className="py-1">
            {contextMenu.item.state === "completed" && onOpenFile && (
              <button
                onClick={() => {
                  onOpenFile(contextMenu.item!.savePath);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-n2c374d hover:text-nwhite text-left font-medium text-blue-300"
              >
                <FileDown size={14} className="text-blue-400" />
                <span>{t.contextMenu.openFile}</span>
              </button>
            )}

            <button
              onClick={() => {
                onOpenFolder(contextMenu.item!.savePath);
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
              className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-n2c374d hover:text-nwhite text-left"
            >
              <FolderOpen size={14} className="text-n8e95a5" />
              <span>{t.contextMenu.openFolder}</span>
            </button>
          </div>

          {/* Section 2: Queue / State Controls */}
          <div className="py-1">
            {contextMenu.item.state === "downloading" ? (
              <button
                onClick={() => {
                  onPause(contextMenu.item!.id);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-n2c374d hover:text-nwhite text-left"
              >
                <Pause size={14} className="text-amber-400" />
                <span>{t.contextMenu.pause}</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onResume(contextMenu.item!.id);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-n2c374d hover:text-nwhite text-left"
              >
                <Play size={14} className="text-emerald-400" />
                <span>{t.contextMenu.resume}</span>
              </button>
            )}

            {onRedownload && (
              <button
                onClick={() => {
                  onRedownload(contextMenu.item!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-n2c374d hover:text-nwhite text-left"
              >
                <RotateCw size={14} className="text-blue-400" />
                <span>{t.contextMenu.redownload}</span>
              </button>
            )}
          </div>

          {/* Section 3: URL and Details */}
          <div className="py-1">
            <button
              onClick={() => handleCopyUrl(contextMenu.item!.url)}
              className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-n2c374d hover:text-nwhite text-left"
            >
              <Copy size={14} className="text-n8e95a5" />
              <span>{t.contextMenu.copyUrl}</span>
            </button>

            <button
              onClick={() => {
                onOpenDetail(contextMenu.item!);
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
              className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-n2c374d hover:text-nwhite text-left"
            >
              <Info size={14} className="text-n8e95a5" />
              <span>{t.contextMenu.showDetails}</span>
            </button>
          </div>

          {/* Section 4: Deletion Options */}
          <div className="py-1">
            <button
              onClick={() => {
                onDelete(contextMenu.item!.id, false);
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
              className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-n2c374d hover:text-nwhite text-left text-red-300"
            >
              <Trash2 size={14} className="text-red-400" />
              <span>{t.contextMenu.removeFromList}</span>
            </button>

            <button
              onClick={() => {
                setDeleteFileTarget(contextMenu.item!.id);
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
              className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-red-900/60 hover:text-red-200 text-left text-red-400 font-medium"
            >
              <Trash2 size={14} className="text-red-500" />
              <span>{t.contextMenu.deleteWithFile}</span>
            </button>
          </div>
        </div>
      )}
      {deleteFileTarget && (
        <ConfirmModal
          message={t.confirm.deleteWithFile}
          confirmLabel={t.confirm.yes}
          cancelLabel={t.confirm.cancel}
          onConfirm={() => {
            onDelete(deleteFileTarget, true);
            setDeleteFileTarget(null);
          }}
          onCancel={() => setDeleteFileTarget(null)}
        />
      )}
    </div>
  );
};
