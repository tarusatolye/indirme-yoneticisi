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
      case "image": return <ImageIcon size={18} className="text-[#8e95a5]" />;
      case "music": return <Music size={18} className="text-[#8e95a5]" />;
      case "video": return <Film size={18} className="text-[#8e95a5]" />;
      case "apps": return <LayoutGrid size={18} className="text-[#8e95a5]" />;
      case "document": return <FileText size={18} className="text-[#8e95a5]" />;
      case "compressed": return <Archive size={18} className="text-[#8e95a5]" />;
      default: return <File size={18} className="text-[#8e95a5]" />;
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
      className="flex-1 flex flex-col overflow-hidden bg-[#181a1e] select-none text-[#d6d9e0] text-[13px] relative"
      onContextMenu={(e) => {
        // Prevent default browser menu if clicking background
        if ((e.target as HTMLElement).tagName !== "INPUT") {
          e.preventDefault();
        }
      }}
    >
      {/* Table Header */}
      <div className="h-7 bg-[#212429] border-b border-[#2d323b] grid grid-cols-12 text-[#8e95a5] text-xs font-medium px-4 items-center">
        <div className="col-span-6 border-r border-[#2d323b] pr-2">{t.table.name}</div>
        <div className="col-span-2 border-r border-[#2d323b] px-3">{t.table.size}</div>
        <div className="col-span-2 border-r border-[#2d323b] px-3">{t.table.status}</div>
        <div className="col-span-2 px-3">{t.table.speed}</div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#6e7687] text-center p-8 space-y-3">
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
                className={`grid grid-cols-12 items-center px-4 py-2 border-b border-[#212429] cursor-pointer transition-colors group ${
                  isSelected
                    ? "bg-[#28395a] text-white"
                    : isZebra
                    ? "bg-[#1d2025] hover:bg-[#252930]"
                    : "bg-[#181a1e] hover:bg-[#252930]"
                }`}
              >
                {/* Name Column */}
                <div className="col-span-6 flex items-center space-x-3 pr-2 min-w-0">
                  <div className="shrink-0">{getCategoryIcon(item.category)}</div>
                  <div className="min-w-0">
                    <div className="font-medium truncate text-[13px]">{item.fileName}</div>
                    <div className="text-[11px] text-[#8e95a5] truncate">
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
                <div className="col-span-2 px-3 font-mono text-[12px] text-[#c0c5d1]">
                  {item.state === "downloading" ? (
                    <div>
                      <div className="truncate text-[11px]">
                        {item.totalBytes > 0
                          ? `${formatSize(item.receivedBytes)} / ${formatSize(item.totalBytes)}`
                          : formatSize(item.receivedBytes)}
                      </div>
                      {item.totalBytes > 0 && (
                        <div className="w-full bg-[#2d323b] h-1.5 rounded-full mt-1 overflow-hidden">
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
                <div className="col-span-2 px-3 text-[12px]">
                  <span
                    className={
                      item.state === "completed"
                        ? "text-[#a2d8a2] font-medium"
                        : item.state === "downloading"
                        ? "text-[#62a4f8] font-medium"
                        : item.state === "failed"
                        ? "text-[#f87171]"
                        : "text-[#8e95a5]"
                    }
                  >
                    {getStatusLabel(item)}
                  </span>
                </div>

                {/* Speed Column + Actions on Hover */}
                <div className="col-span-2 px-3 flex items-center justify-between min-w-0 font-mono text-[12px] text-[#c0c5d1]">
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
                      className="p-1 hover:text-white text-[#8e95a5] rounded hover:bg-[#343a46]"
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
                        className="p-1 hover:text-white text-[#8e95a5] rounded hover:bg-[#343a46]"
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
                        className="p-1 hover:text-white text-[#8e95a5] rounded hover:bg-[#343a46]"
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
                      className="p-1 hover:text-white text-[#8e95a5] rounded hover:bg-[#343a46]"
                    >
                      <FolderOpen size={14} />
                    </button>
                    <button
                      title={t.toolbar.clearFinished}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                      className="p-1 hover:text-red-400 text-[#8e95a5] rounded hover:bg-[#343a46]"
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
          className="fixed z-50 w-56 bg-[#212429] border border-[#343a46] rounded-lg shadow-2xl py-1 text-xs text-[#d6d9e0] font-sans divide-y divide-[#2c313a]"
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
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-[#2c374d] hover:text-white text-left font-medium text-blue-300"
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
              className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-[#2c374d] hover:text-white text-left"
            >
              <FolderOpen size={14} className="text-[#8e95a5]" />
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
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-[#2c374d] hover:text-white text-left"
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
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-[#2c374d] hover:text-white text-left"
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
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-[#2c374d] hover:text-white text-left"
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
              className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-[#2c374d] hover:text-white text-left"
            >
              <Copy size={14} className="text-[#8e95a5]" />
              <span>{t.contextMenu.copyUrl}</span>
            </button>

            <button
              onClick={() => {
                onOpenDetail(contextMenu.item!);
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
              className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-[#2c374d] hover:text-white text-left"
            >
              <Info size={14} className="text-[#8e95a5]" />
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
              className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-[#2c374d] hover:text-white text-left text-red-300"
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
