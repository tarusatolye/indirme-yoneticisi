import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Link2,
  Plus,
  Play,
  Square,
  Trash2,
  Settings as SettingsIcon,
  Search,
  CloudDownload,
  List,
  ChevronDown,
  RotateCcw,
  Puzzle,
} from "lucide-react";
import { DownloadItem, AppSettings, AddDownloadPayload, ExtensionInfo } from "./types";
import { Sidebar } from "./components/Sidebar";
import { DownloadTable } from "./components/DownloadTable";
import { AddDownloadModal } from "./components/AddDownloadModal";
import { SettingsModal } from "./components/SettingsModal";
import { SegmentsModal } from "./components/SegmentsModal";
import { ExtensionModal } from "./components/ExtensionModal";
import { translations } from "./i18n";

export const App: React.FC = () => {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    download_dir: "",
    segment_count: 8,
    max_concurrent: 3,
    port: 48213,
    ytdlp_path: "yt-dlp",
    language: "tr",
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clearMenuOpen, setClearMenuOpen] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExtensionOpen, setIsExtensionOpen] = useState(false);
  const [extensionInfo, setExtensionInfo] = useState<ExtensionInfo | null>(null);
  const [detailItem, setDetailItem] = useState<DownloadItem | null>(null);
  const [updateDownloadedVersion, setUpdateDownloadedVersion] = useState<string | null>(null);

  const lang = settings.language || "tr";
  const t = translations[lang];

  // Helper to normalize items from backend
  const normalizeItem = (raw: any): DownloadItem => {
    return {
      id: raw.id,
      url: raw.url || "",
      fileName: raw.fileName || raw.file_name || "download",
      savePath: raw.savePath || raw.save_path || "",
      kind: raw.kind || "file",
      category: raw.category || "other",
      state: raw.state || raw.status || "downloading",
      totalBytes: raw.totalBytes || raw.total_size || 0,
      receivedBytes: raw.receivedBytes || raw.downloaded_size || 0,
      supportsRanges: raw.supportsRanges ?? true,
      segments: raw.segments || [],
      speed: raw.speed || 0,
      errorMessage: raw.errorMessage || raw.error_message || null,
      createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
      completedAt: raw.completedAt || raw.completed_at || null,
      referrer: raw.referrer || "",
      cookies: raw.cookies || "",
      userAgent: raw.userAgent || raw.user_agent || "",
    };
  };

  // Fetch initial data
  useEffect(() => {
    invoke<any[]>("get_downloads")
      .then((res) => {
        if (Array.isArray(res)) {
          setItems(res.map(normalizeItem));
        }
      })
      .catch((e) => console.error("Could not fetch downloads:", e));

    invoke<AppSettings>("get_settings")
      .then(setSettings)
      .catch((e) => console.error("Could not fetch settings:", e));
  }, []);

  // Listen for real-time events
  useEffect(() => {
    const unlistenAdd = listen<any>("download_added", (event) => {
      const item = normalizeItem(event.payload);
      setItems((prev) => [item, ...prev.filter((i) => i.id !== item.id)]);
      // IDM Feature: Automatically open download detail window for new downloads!
      setDetailItem(item);
    });

    const unlistenUpdate = listen<any>("download_updated", (event) => {
      const item = normalizeItem(event.payload);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? item : i))
      );
      setDetailItem((curr) => (curr && curr.id === item.id ? item : curr));
    });

    const unlistenDelete = listen<string>("download_deleted", (event) => {
      setItems((prev) => prev.filter((i) => i.id !== event.payload));
      setSelectedIds((prev) => prev.filter((id) => id !== event.payload));
      setDetailItem((curr) => (curr && curr.id === event.payload ? null : curr));
    });

    const unlistenUpdateDownloaded = listen<{ version: string }>("update_downloaded", (event) => {
      setUpdateDownloadedVersion(event.payload?.version || "Yeni");
    });

    const unlistenExtStatus = listen<any>("extension_status", (event) => {
      if (event.payload) {
        setExtensionInfo((prev) => ({
          path: prev?.path || "",
          exists: prev?.exists ?? true,
          isConnected: Boolean(event.payload.isConnected),
          lastPing: event.payload.lastPing || Date.now(),
          browser: event.payload.browser || prev?.browser || null,
          port: settings.port || 48213,
        }));
      }
    });

    // Check extension status periodically
    const checkExt = () => {
      invoke<ExtensionInfo>("get_extension_info")
        .then(setExtensionInfo)
        .catch(() => {});
    };
    checkExt();
    const extInterval = setInterval(checkExt, 3000);

    return () => {
      unlistenAdd.then((f) => f());
      unlistenUpdate.then((f) => f());
      unlistenDelete.then((f) => f());
      unlistenUpdateDownloaded.then((f) => f());
      unlistenExtStatus.then((f) => f());
      clearInterval(extInterval);
    };
  }, [settings.port]);

  // Actions
  const handleAdd = async (payload: AddDownloadPayload) => {
    try {
      await invoke("add_download", { payload });
    } catch (e) {
      console.error("Failed to add download:", e);
    }
  };

  const handlePause = async (id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              state: "paused",
              speed: 0,
              segments: i.segments?.map((s) => ({ ...s, active: false })) || [],
            }
          : i
      )
    );
    setDetailItem((curr) =>
      curr && curr.id === id
        ? {
            ...curr,
            state: "paused",
            speed: 0,
            segments: curr.segments?.map((s) => ({ ...s, active: false })) || [],
          }
        : curr
    );
    await invoke("pause_download", { id });
  };

  const handleResume = async (id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, state: "downloading", errorMessage: null } : i
      )
    );
    setDetailItem((curr) =>
      curr && curr.id === id
        ? { ...curr, state: "downloading", errorMessage: null }
        : curr
    );
    await invoke("resume_download", { id });
  };

  const handleCancel = async (id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              state: "cancelled",
              speed: 0,
              segments: i.segments?.map((s) => ({ ...s, active: false })) || [],
            }
          : i
      )
    );
    setDetailItem((curr) =>
      curr && curr.id === id
        ? {
            ...curr,
            state: "cancelled",
            speed: 0,
            segments: curr.segments?.map((s) => ({ ...s, active: false })) || [],
          }
        : curr
    );
    await invoke("cancel_download", { id });
  };

  const handleDelete = async (id: string, deleteFile = false) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedIds((prev) => prev.filter((i) => i !== id));
    setDetailItem((curr) => (curr && curr.id === id ? null : curr));
    await invoke("delete_download", { id, deleteFile });
  };

  const handleOpenFile = async (path: string) => {
    await invoke("open_file", { path });
  };

  const handleOpenFolder = async (path: string) => {
    await invoke("open_folder", { path });
  };

  const handleRedownload = async (item: DownloadItem) => {
    await handleDelete(item.id, false);
    await handleAdd({
      url: item.url,
      fileName: item.fileName,
      isVideo: item.kind === "video" || item.category === "video",
    });
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await invoke("save_settings", { newSettings });
  };

  const handlePauseAll = () => {
    items
      .filter((i) => i.state === "downloading")
      .forEach((i) => handlePause(i.id));
  };

  const handleResumeAll = () => {
    items
      .filter((i) => i.state === "paused" || i.state === "failed")
      .forEach((i) => handleResume(i.id));
  };

  const handleClearFinished = () => {
    items
      .filter((i) => i.state === "completed" || i.state === "cancelled")
      .forEach((i) => handleDelete(i.id, false));
    setClearMenuOpen(false);
  };

  const handleClearUnfinished = () => {
    items
      .filter((i) => i.state === "paused" || i.state === "failed" || i.state === "cancelled")
      .forEach((i) => handleDelete(i.id, false));
    setClearMenuOpen(false);
  };

  const handleClearAll = () => {
    if (window.confirm(lang === "tr" ? "Tüm indirme listesini temizlemek istediğinize emin misiniz?" : "Are you sure you want to clear the entire list?")) {
      items.forEach((i) => handleDelete(i.id, false));
      setClearMenuOpen(false);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach((id) => handleDelete(id, false));
    setSelectedIds([]);
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.url.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedCategory === "all") return true;
    if (selectedCategory === "finished") return item.state === "completed";
    if (selectedCategory === "unfinished") return item.state !== "completed";
    return item.category === selectedCategory;
  });

  // Calculate total download speed
  const totalSpeed = items
    .filter((i) => i.state === "downloading")
    .reduce((acc, curr) => acc + (curr.speed || 0), 0);

  const formatTotalSpeed = (bytes: number) => {
    if (bytes <= 0) return "0 bytes/s";
    if (bytes < 1024) return bytes.toFixed(0) + " B/s";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB/s";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB/s";
  };

  return (
    <div className="flex h-screen bg-[#181a1e] text-[#d6d9e0] flex-col overflow-hidden font-sans select-none">
      {/* Top macOS Style Toolbar matching docs/main.png */}
      <header className="h-12 bg-[#212429] border-b border-[#16181b] px-4 flex items-center justify-between shrink-0">
        {/* App Title with tarus Brand Mark */}
        <div className="flex items-center space-x-2.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            className="w-6 h-6 shrink-0 rounded-[5px] shadow"
          >
            <rect width="512" height="512" rx="96" fill="#1e3a8a" />
            <g
              transform="translate(64 64) scale(16)"
              color="#ffffff"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M17 9.00195C19.175 9.01406 20.3529 9.11051 21.1213 9.8789C22 10.7576 22 12.1718 22 15.0002V16.0002C22 18.8286 22 20.2429 21.1213 21.1215C20.2426 22.0002 18.8284 22.0002 16 22.0002H8C5.17157 22.0002 3.75736 22.0002 2.87868 21.1215C2 20.2429 2 18.8286 2 16.0002L2 15.0002C2 12.1718 2 10.7576 2.87868 9.87889C3.64706 9.11051 4.82497 9.01406 7 9.00195" />
              <path strokeLinejoin="round" d="M12 2L12 15M15 11.5L12 15L9 11.5" />
            </g>
          </svg>
          <h1 className="text-sm font-semibold tracking-wide text-white">
            {t.appTitle}
          </h1>
        </div>

        {/* Action Button Group (Compact Pill Toolbar) */}
        <div className="flex items-center space-x-1.5 bg-[#2b3038] p-1 rounded-lg border border-[#373d47]">
          <button
            onClick={() => setIsAddOpen(true)}
            title={t.toolbar.addUrl}
            className="p-1.5 text-[#cfd3dc] hover:text-white hover:bg-[#383f4b] rounded transition-colors"
          >
            <div className="relative">
              <Link2 size={16} />
              <Plus size={10} className="absolute -top-1 -right-1 text-blue-400 font-bold" />
            </div>
          </button>

          <button
            onClick={handleResumeAll}
            title={t.toolbar.startQueue}
            className="p-1.5 text-[#cfd3dc] hover:text-white hover:bg-[#383f4b] rounded transition-colors"
          >
            <Play size={15} />
          </button>

          <button
            onClick={handlePauseAll}
            title={t.toolbar.stopAll}
            className="p-1.5 text-[#cfd3dc] hover:text-white hover:bg-[#383f4b] rounded transition-colors"
          >
            <Square size={14} />
          </button>

          {/* Clear Dropdown Menu */}
          <div className="relative">
            <div className="flex items-center">
              <button
                onClick={handleClearFinished}
                title={t.toolbar.clearFinished}
                className="p-1.5 text-[#cfd3dc] hover:text-white hover:bg-[#383f4b] rounded-l transition-colors"
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={() => setClearMenuOpen(!clearMenuOpen)}
                title="Temizleme Seçenekleri"
                className="p-1 text-[#8e95a5] hover:text-white hover:bg-[#383f4b] rounded-r border-l border-[#373d47] transition-colors"
              >
                <ChevronDown size={11} />
              </button>
            </div>

            {clearMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-52 bg-[#212429] border border-[#373d47] rounded-lg shadow-xl py-1 z-50 text-xs text-[#d6d9e0]"
                onMouseLeave={() => setClearMenuOpen(false)}
              >
                <button
                  onClick={handleClearFinished}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2c374d] hover:text-white flex items-center justify-between"
                >
                  <span>{t.toolbar.clearFinished}</span>
                  <span className="text-[11px] text-[#8e95a5] font-mono">
                    {items.filter((i) => i.state === "completed" || i.state === "cancelled").length}
                  </span>
                </button>
                <button
                  onClick={handleClearUnfinished}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#2c374d] hover:text-white flex items-center justify-between"
                >
                  <span>{t.toolbar.clearUnfinished}</span>
                  <span className="text-[11px] text-[#8e95a5] font-mono">
                    {items.filter((i) => i.state === "paused" || i.state === "failed").length}
                  </span>
                </button>
                <div className="h-px bg-[#323843] my-1" />
                <button
                  onClick={handleClearAll}
                  className="w-full text-left px-3 py-1.5 hover:bg-red-900/50 hover:text-red-200 text-red-400 flex items-center justify-between"
                >
                  <span>{t.toolbar.clearAll}</span>
                  <span className="text-[11px] font-mono">{items.length}</span>
                </button>
              </div>
            )}
          </div>

          {selectedIds.length > 0 && (
            <>
              <div className="w-px h-4 bg-[#3d4452] mx-1" />
              <button
                onClick={handleDeleteSelected}
                title={`${t.toolbar.deleteSelected} (${selectedIds.length})`}
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-red-950/60 hover:bg-red-900/80 text-red-300 rounded border border-red-800/60 transition-colors"
              >
                <Trash2 size={13} />
                <span>{selectedIds.length}</span>
              </button>
            </>
          )}

          <div className="w-px h-4 bg-[#3d4452] mx-1" />

          <button
            onClick={() => setIsExtensionOpen(true)}
            title={
              extensionInfo?.isConnected
                ? `${t.toolbar.extension} (${t.statusBar.extensionConnected})`
                : `${t.toolbar.extension} (${t.statusBar.extensionNotConnected})`
            }
            className={`relative p-1.5 rounded transition-colors ${
              extensionInfo?.isConnected
                ? "text-emerald-400 hover:text-emerald-300 hover:bg-[#383f4b]"
                : "text-[#cfd3dc] hover:text-white hover:bg-[#383f4b]"
            }`}
          >
            <Puzzle size={15} />
            <span
              className={`absolute top-1 right-1 w-2 h-2 rounded-full border border-[#2b3038] ${
                extensionInfo?.isConnected
                  ? "bg-emerald-400 shadow-sm shadow-emerald-400"
                  : "bg-amber-400"
              }`}
            />
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            title={t.toolbar.settings}
            className="p-1.5 text-[#cfd3dc] hover:text-white hover:bg-[#383f4b] rounded transition-colors"
          >
            <SettingsIcon size={15} />
          </button>
        </div>

        {/* Search Bar matching docs/main.png */}
        <div className="relative w-56">
          <Search size={14} className="absolute left-2.5 top-2 text-[#8e95a5]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.toolbar.searchPrompt}
            className="w-full bg-[#181a1e] border border-[#343a46] rounded-md pl-8 pr-3 py-1 text-xs text-[#cfd3dc] placeholder-[#6f7787] focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </header>

      {/* Main Split View: Sidebar + Downloads Table */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          items={items}
          lang={lang}
          onClearFinished={handleClearFinished}
          onClearUnfinished={handleClearUnfinished}
        />
        <main className="flex-1 flex flex-col overflow-hidden">
          <DownloadTable
            items={filteredItems}
            selectedIds={selectedIds}
            onSelectIds={setSelectedIds}
            onOpenDetail={(item) => setDetailItem(item)}
            onPause={handlePause}
            onResume={handleResume}
            onCancel={handleCancel}
            onDelete={handleDelete}
            onOpenFolder={handleOpenFolder}
            onOpenFile={handleOpenFile}
            onRedownload={handleRedownload}
            lang={lang}
          />
        </main>
      </div>

      {/* Bottom Status Bar matching docs/main.png */}
      <footer className="h-7 bg-[#1c1f24] border-t border-[#16181b] px-4 flex items-center justify-between text-xs text-[#8e95a5]">
        {/* Left: Version + Bridge & Extension indicator */}
        <div
          onClick={() => setIsExtensionOpen(true)}
          className="flex items-center space-x-2.5 cursor-pointer hover:text-white transition-colors group"
          title="Tarayıcı Eklentisi Ayarları"
        >
          <span className="text-[11px] font-mono text-[#8e95a5] select-all">
            v.0.0.2
          </span>
          <div
            className={`w-2 h-2 rounded-full shadow-sm transition-all ${
              extensionInfo?.isConnected
                ? "bg-emerald-500 shadow-emerald-500/50"
                : "bg-amber-500 shadow-amber-500/50"
            }`}
          />
          <span className="text-[12px] text-[#a0a7b6] group-hover:text-white transition-colors">
            {extensionInfo?.isConnected
              ? `${t.statusBar.extensionConnected}${
                  extensionInfo.browser
                    ? ` (${extensionInfo.browser.toUpperCase()})`
                    : ""
                }`
              : t.statusBar.extensionNotConnected}
          </span>
        </div>

        {/* Stats on the right */}
        <div className="flex items-center space-x-4 text-[12px] text-[#a0a7b6] font-mono">
          <div className="flex items-center space-x-1.5" title="Total downloads">
            <List size={14} className="text-[#8e95a5]" />
            <span>{items.length}</span>
          </div>

          <div className="flex items-center space-x-1.5" title="Total download speed">
            <CloudDownload size={14} className="text-[#8e95a5]" />
            <span>{formatTotalSpeed(totalSpeed)}</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AddDownloadModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdd={handleAdd}
        lang={lang}
      />

      <ExtensionModal
        isOpen={isExtensionOpen}
        onClose={() => setIsExtensionOpen(false)}
        lang={lang}
        port={settings.port}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
        lang={lang}
      />

      <SegmentsModal
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onPause={handlePause}
        onResume={handleResume}
        onCancel={handleCancel}
        onOpenFolder={handleOpenFolder}
        lang={lang}
      />

      {/* Auto Update Notification Toast */}
      {updateDownloadedVersion && (
        <div className="fixed bottom-10 right-4 z-50 bg-[#1e232d] border border-blue-500/60 shadow-2xl rounded-lg p-3.5 max-w-sm flex items-start space-x-3 backdrop-blur-md">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
            <CloudDownload size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-white">Yeni Sürüm Hazır!</h4>
            <p className="text-[11px] text-[#a0a7b6] mt-0.5 leading-relaxed">
              İndirme Yöneticisi v{updateDownloadedVersion} indirildi. Güncellemeyi tamamlamak için yeniden başlatın.
            </p>
            <div className="mt-2.5 flex items-center space-x-2">
              <button
                onClick={() => invoke("restart_and_update")}
                className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded font-medium shadow-sm transition-colors"
              >
                Yeniden Başlat ve Güncelle
              </button>
              <button
                onClick={() => setUpdateDownloadedVersion(null)}
                className="px-2 py-1 text-xs text-[#8e95a5] hover:text-white transition-colors"
              >
                Sonra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
