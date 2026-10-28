import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  X,
  Puzzle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  FolderOpen,
  Copy,
  Check,
  Globe,
  Compass,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { ExtensionInfo } from "../types";
import { translations } from "../i18n";

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: "tr" | "en";
  port?: number;
}

export const ExtensionModal: React.FC<ExtensionModalProps> = ({
  isOpen,
  onClose,
  lang,
  port = 48213,
}) => {
  if (!isOpen) return null;

  const t = translations[lang].extensionModal;
  const [selectedBrowser, setSelectedBrowser] = useState<
    "chrome" | "edge" | "brave" | "firefox" | "opera"
  >("chrome");
  const [info, setInfo] = useState<ExtensionInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  // Poll extension info to detect real-time connection
  useEffect(() => {
    let isMounted = true;

    const fetchInfo = async () => {
      try {
        const res = await invoke<ExtensionInfo>("get_extension_info");
        if (isMounted) {
          setInfo(res);
        }
      } catch (err) {
        console.error("Could not fetch extension info:", err);
      }
    };

    fetchInfo();
    const interval = setInterval(fetchInfo, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleOpenBrowserAndFolder = async () => {
    setIsOpening(true);
    try {
      await invoke("open_browser_extensions_page", {
        browser: selectedBrowser,
        openFolder: true,
      });
    } catch (err) {
      console.error("Failed to open browser extensions page:", err);
    } finally {
      setIsOpening(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await invoke("open_extension_folder");
    } catch (err) {
      console.error("Failed to open extension folder:", err);
    }
  };

  const handleCopyPath = async () => {
    try {
      await invoke("copy_extension_path");
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error("Failed to copy path:", err);
    }
  };

  const browsers: {
    id: "chrome" | "edge" | "brave" | "firefox" | "opera";
    name: string;
    urlName: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    {
      id: "chrome",
      name: "Google Chrome",
      urlName: "chrome://extensions",
      icon: <Globe size={15} />,
      color: "#4285F4",
    },
    {
      id: "edge",
      name: "Microsoft Edge",
      urlName: "edge://extensions",
      icon: <Compass size={15} />,
      color: "#0078D7",
    },
    {
      id: "brave",
      name: "Brave",
      urlName: "brave://extensions",
      icon: <ShieldCheck size={15} />,
      color: "#FB542B",
    },
    {
      id: "firefox",
      name: "Mozilla Firefox",
      urlName: "about:debugging",
      icon: <Puzzle size={15} />,
      color: "#FF7139",
    },
    {
      id: "opera",
      name: "Opera",
      urlName: "opera://extensions",
      icon: <Compass size={15} />,
      color: "#FF1B2D",
    },
  ];

  const isConnected = Boolean(info && info.isConnected);

  return (
    <div className="fixed inset-0 z-50 modal-perde backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#24272d] border border-[#3b424e] rounded-xl w-full max-w-xl shadow-2xl overflow-hidden text-[#d4d8e2] text-xs font-sans">
        {/* Header */}
        <div className="h-11 px-4 bg-[#1e2126] border-b border-[#323843] flex items-center justify-between select-none">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded-md bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Puzzle size={14} />
            </div>
            <div>
              <span className="font-semibold text-white text-[13px] block leading-tight">
                {t.title}
              </span>
              <span className="text-[10px] text-[#8e95a5] block">
                {t.subtitle}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8e95a5] hover:text-white p-1 rounded hover:bg-[#343a46] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto custom-scroll">
          {/* Live Status Banner */}
          <div
            className={`p-3.5 rounded-lg border flex items-center justify-between transition-all ${
              isConnected
                ? "bg-emerald-950/40 border-emerald-700/50 text-emerald-200"
                : "bg-amber-950/30 border-amber-800/40 text-amber-200"
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  isConnected
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-amber-500/20 text-amber-400"
                }`}
              >
                {isConnected ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertCircle size={18} />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-[13px]">
                    {isConnected ? t.statusConnected : t.statusDisconnected}
                  </span>
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      isConnected
                        ? "bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400"
                        : "bg-amber-400"
                    }`}
                  />
                </div>
                <p className="text-[11px] opacity-80 mt-0.5">
                  {isConnected
                    ? `${t.connectedBrowser}: ${
                        info?.browser
                          ? info.browser.toUpperCase()
                          : "WebExtension"
                      } · 127.0.0.1:${port}`
                    : t.howItWorks}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-black/30 border border-white/10 text-white/80">
                Port: {port}
              </span>
            </div>
          </div>

          {/* Browser Selector Pills */}
          <div className="space-y-1.5 select-none">
            <label className="text-[11px] font-medium text-[#8e95a5]">
              {t.selectBrowser}
            </label>
            <div className="grid grid-cols-5 gap-2">
              {browsers.map((b) => {
                const isSelected = selectedBrowser === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBrowser(b.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-center ${
                      isSelected
                        ? "bg-[#2d333e] border-blue-500 text-white shadow-sm"
                        : "bg-[#1c1e23] border-[#323843] text-[#8e95a5] hover:text-[#cfd3dc] hover:bg-[#252830]"
                    }`}
                  >
                    <div
                      className="mb-1"
                      style={{ color: isSelected ? b.color : undefined }}
                    >
                      {b.icon}
                    </div>
                    <span className="text-[11px] font-medium leading-none">
                      {b.name.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 Step Interactive Setup Card */}
          <div className="bg-[#1b1e23] border border-[#343a46] rounded-xl p-4 space-y-3.5">
            <div className="text-xs font-semibold text-white flex items-center space-x-1.5">
              <span>Kurulum Adımları</span>
              <span className="text-[11px] font-normal text-[#8e95a5]">
                ({browsers.find((b) => b.id === selectedBrowser)?.name} için)
              </span>
            </div>

            {/* Step 1 */}
            <div className="flex items-start space-x-3 bg-[#22252c] p-3 rounded-lg border border-[#303642]">
              <div className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                1
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="font-medium text-white text-[12px]">
                  {t.step1Title}
                </div>
                <p className="text-[11px] text-[#8e95a5] leading-relaxed">
                  {t.step1Desc}
                </p>
                <button
                  type="button"
                  onClick={handleOpenBrowserAndFolder}
                  disabled={isOpening}
                  className="inline-flex items-center space-x-1.5 bg-[#2f6feb] hover:bg-[#255ec4] text-white px-3 py-1.5 rounded-md font-medium text-xs transition-colors shadow-sm"
                >
                  <ExternalLink size={12} />
                  <span>
                    {browsers.find((b) => b.id === selectedBrowser)?.name}{" "}
                    Eklentiler Sayfasını Aç
                  </span>
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start space-x-3 bg-[#22252c] p-3 rounded-lg border border-[#303642]">
              <div className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                2
              </div>
              <div className="flex-1">
                <div className="font-medium text-white text-[12px]">
                  {t.step2Title}
                </div>
                <p className="text-[11px] text-[#8e95a5] leading-relaxed mt-0.5">
                  {t.step2Desc}
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start space-x-3 bg-[#22252c] p-3 rounded-lg border border-[#303642]">
              <div className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                3
              </div>
              <div className="flex-1 space-y-2">
                <div className="font-medium text-white text-[12px]">
                  {t.step3Title}
                </div>
                <p className="text-[11px] text-[#8e95a5] leading-relaxed">
                  {t.step3Desc}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleOpenFolder}
                    className="inline-flex items-center space-x-1.5 bg-[#2d323b] hover:bg-[#383e4a] text-white px-3 py-1.5 rounded-md border border-[#3f4654] transition-colors"
                  >
                    <FolderOpen size={12} className="text-amber-400" />
                    <span>{t.btnOpenFolder}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyPath}
                    className="inline-flex items-center space-x-1.5 bg-[#2d323b] hover:bg-[#383e4a] text-[#cfd3dc] px-3 py-1.5 rounded-md border border-[#3f4654] transition-colors"
                  >
                    {copied ? (
                      <Check size={12} className="text-emerald-400" />
                    ) : (
                      <Copy size={12} />
                    )}
                    <span>{copied ? t.copied : t.btnCopyPath}</span>
                  </button>
                </div>

                {info?.path && (
                  <div className="bg-[#181a1e] p-2 rounded border border-[#2d333e] font-mono text-[10px] text-[#8e95a5] break-all select-all">
                    {info.path}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Success Auto-detection Banner */}
          {isConnected && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-600/60 rounded-lg flex items-center space-x-2.5 text-emerald-300">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span className="text-xs font-medium">{t.autoDetected}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-12 px-5 bg-[#1e2126] border-t border-[#323843] flex items-center justify-between select-none">
          <div className="flex items-center space-x-1.5 text-[11px] text-[#8e95a5]">
            <RefreshCw size={11} className="animate-spin text-blue-400" />
            <span>Otomatik algılama devrede</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#2d323b] hover:bg-[#383e4a] text-white rounded-md border border-[#3f4654] transition-colors font-medium text-xs"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
