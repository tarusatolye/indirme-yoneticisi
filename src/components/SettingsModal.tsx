import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Settings as SettingsIcon, Info, ExternalLink, GitFork, ShieldCheck, Heart, RefreshCw } from "lucide-react";
import { AppSettings } from "../types";
import { translations } from "../i18n";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  lang: "tr" | "en";
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  lang,
}) => {
  if (!isOpen) return null;
  const t = translations[lang].settingsModal;

  const [activeTab, setActiveTab] = useState<"general" | "about">("general");
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "latest" | "downloading" | "error">("idle");
  const [updateMessage, setUpdateMessage] = useState<string>("");

  const handleCheckUpdate = async () => {
    setUpdateStatus("checking");
    setUpdateMessage("");
    try {
      const res: any = await invoke("check_for_updates");
      if (res && res.status === "dev_mode") {
        setUpdateStatus("idle");
        setUpdateMessage("Geliştirici modunda güncelleme denetlenemez.");
      } else if (res && res.updateInfo && res.updateInfo.version) {
        setUpdateStatus("downloading");
        setUpdateMessage(`Yeni sürüm (v${res.updateInfo.version}) indiriliyor...`);
      } else {
        setUpdateStatus("latest");
        setUpdateMessage("Uygulama güncel (v.0.0.1)");
      }
    } catch {
      setUpdateStatus("error");
      setUpdateMessage("Güncelleme denetlenirken hata oluştu.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#24272d] border border-[#3b424e] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden text-[#d4d8e2] text-xs font-sans">
        {/* Header with Title and Close Button */}
        <div className="h-10 px-4 bg-[#1e2126] border-b border-[#323843] flex items-center justify-between select-none">
          <div className="flex items-center space-x-2">
            <SettingsIcon size={14} className="text-[#8e95a5]" />
            <span className="font-medium text-white">{t.title}</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#8e95a5] hover:text-white p-1 rounded hover:bg-[#343a46] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#323843] bg-[#212429] px-4 select-none">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 font-medium text-xs transition-colors ${
              activeTab === "general"
                ? "border-blue-500 text-white"
                : "border-transparent text-[#8e95a5] hover:text-[#d4d8e2]"
            }`}
          >
            <SettingsIcon size={13} />
            <span>{t.tabGeneral}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("about")}
            className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 font-medium text-xs transition-colors ${
              activeTab === "about"
                ? "border-blue-500 text-white"
                : "border-transparent text-[#8e95a5] hover:text-[#d4d8e2]"
            }`}
          >
            <Info size={13} />
            <span>{t.tabAbout}</span>
          </button>
        </div>

        {/* Tab 1: General Settings */}
        {activeTab === "general" && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="space-y-1">
              <label className="text-[#8e95a5] font-medium">{t.downloadDir}</label>
              <input
                type="text"
                value={form.download_dir}
                onChange={(e) => setForm({ ...form, download_dir: e.target.value })}
                className="w-full bg-[#181a1e] border border-[#343a46] rounded-md px-3 py-1.5 text-xs text-white placeholder-[#6f7787] focus:outline-none focus:border-blue-500 font-mono transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[#8e95a5] font-medium">{t.segmentCount}</label>
                <select
                  value={form.segment_count}
                  onChange={(e) => setForm({ ...form, segment_count: parseInt(e.target.value, 10) })}
                  className="w-full bg-[#181a1e] border border-[#343a46] rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value={1}>1 (Tek bağlantı)</option>
                  <option value={2}>2</option>
                  <option value={4}>4</option>
                  <option value={8}>8 (Önerilen / IDM Default)</option>
                  <option value={16}>16 (Maksimum hız)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[#8e95a5] font-medium">{t.language}</label>
                <select
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value as "tr" | "en" })}
                  className="w-full bg-[#181a1e] border border-[#343a46] rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="tr">Türkçe (İndirme Yöneticisi)</option>
                  <option value="en">English (Download Manager)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[#8e95a5] font-medium">{t.port}</label>
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: parseInt(e.target.value, 10) || 48213 })}
                  className="w-full bg-[#181a1e] border border-[#343a46] rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#8e95a5] font-medium">{t.maxConcurrent}</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.max_concurrent}
                  onChange={(e) => setForm({ ...form, max_concurrent: parseInt(e.target.value, 10) || 3 })}
                  className="w-full bg-[#181a1e] border border-[#343a46] rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#323843]">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 bg-[#2d323b] hover:bg-[#383e4a] text-[#cfd3dc] rounded border border-[#3b424e] transition-colors"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="px-3.5 py-1 bg-[#2f6feb] hover:bg-[#255ec4] text-white rounded border border-[#3b75f2] transition-colors font-medium shadow-sm"
              >
                {t.save}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: About & Open Source Attribution */}
        {activeTab === "about" && (
          <div className="p-5 space-y-4">
            {/* App Card */}
            <div className="flex items-center space-x-3.5 bg-[#1e2126] p-3.5 rounded-lg border border-[#343a46]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 512 512"
                className="w-11 h-11 rounded-lg shrink-0 shadow"
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
              <div>
                <div className="flex items-center space-x-2.5">
                  <h3 className="font-semibold text-white text-sm">{t.aboutTitle}</h3>
                  <span className="text-[11px] text-[#8e95a5] font-mono select-all">
                    v.0.0.1
                  </span>
                  <button
                    type="button"
                    onClick={handleCheckUpdate}
                    disabled={updateStatus === "checking"}
                    className="flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded bg-[#2a2f3a] hover:bg-[#353c4a] text-blue-400 border border-[#3b4352] transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={10} className={updateStatus === "checking" ? "animate-spin" : ""} />
                    <span>
                      {updateStatus === "checking"
                        ? "Denetleniyor..."
                        : "Güncellemeleri Denetle"}
                    </span>
                  </button>
                </div>
                <p className="text-[11px] text-[#8e95a5] mt-0.5">{t.aboutSubtitle}</p>
                {updateMessage && (
                  <p className={`text-[11px] mt-1 ${updateStatus === 'error' ? 'text-red-400' : updateStatus === 'latest' ? 'text-emerald-400' : 'text-blue-400'}`}>
                    {updateMessage}
                  </p>
                )}
              </div>
            </div>

            {/* Attribution Box */}
            <div className="bg-[#1b1e23] border border-[#343a46] rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center space-x-1.5 text-blue-400 font-medium text-xs">
                <GitFork size={14} />
                <span>{t.attributionTitle}</span>
              </div>
              <p className="text-xs text-[#c0c5d1] leading-relaxed">
                {t.attributionText}
              </p>

              <div className="pt-1">
                <a
                  href={t.repoLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-950/40 hover:bg-blue-900/50 px-2.5 py-1 rounded border border-blue-800/40 transition-colors"
                >
                  <ExternalLink size={12} />
                  <span>github.com/tarusatolye/indirme-yoneticisi</span>
                </a>
              </div>
            </div>

            {/* License & Components */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#1b1e23] border border-[#343a46] rounded-lg p-3 space-y-1">
                <div className="flex items-center space-x-1.5 text-[#a2d8a2] font-medium">
                  <ShieldCheck size={13} />
                  <span>{t.license}</span>
                </div>
                <p className="text-[#8e95a5] text-[11px]">{t.licenseType}</p>
                <p className="text-[10px] text-blue-400 mt-1">© 2026 tarusatolye</p>
              </div>

              <div className="bg-[#1b1e23] border border-[#343a46] rounded-lg p-3 space-y-1">
                <div className="flex items-center space-x-1.5 text-pink-400 font-medium">
                  <Heart size={13} />
                  <span>{t.coreEngines}</span>
                </div>
                <p className="text-[#8e95a5] text-[11px]">yt-dlp, FFmpeg, React, Electron</p>
                <p className="text-[10px] text-[#8e95a5] mt-1">Yayımcı: tarusatolye</p>
              </div>
            </div>

            {/* EULA Contract Box */}
            <div className="bg-[#15171b] border border-[#2c313a] rounded-lg p-3 text-[11px] text-[#8e95a5] space-y-1">
              <div className="text-white font-medium text-xs">Kullanıcı Sözleşmesi ve Telif Sorumluluğu</div>
              <p className="leading-relaxed">
                Yazılım açık kaynaklı ve ücretsiz bir indirme aracıdır. İndirilen içeriklerin telif hakları ve yasal izinlerinden tamamen Kullanıcı sorumludur. Yazılım hiçbir kullanıcı verisini uzak sunuculara aktarmaz.
              </p>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-[#323843]">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1 bg-[#2d323b] hover:bg-[#383e4a] text-[#cfd3dc] rounded border border-[#3b424e] transition-colors text-xs"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
