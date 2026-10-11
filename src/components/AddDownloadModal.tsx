import React, { useState } from "react";
import { X, Link2 } from "lucide-react";
import { AddDownloadPayload } from "../types";
import { translations } from "../i18n";

interface AddDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (payload: AddDownloadPayload) => void;
  lang: "tr" | "en";
}

export const AddDownloadModal: React.FC<AddDownloadModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  lang,
}) => {
  if (!isOpen) return null;
  const t = translations[lang].addModal;

  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [isVideo, setIsVideo] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    onAdd({
      url: url.trim(),
      fileName: fileName.trim() || undefined,
      isVideo,
    });

    setUrl("");
    setFileName("");
    setIsVideo(false);
    onClose();
  };

  const handleUrlChange = (val: string) => {
    setUrl(val);
    if (/youtube\.com|youtu\.be|vimeo\.com|twitter\.com|x\.com|tiktok\.com|instagram\.com/i.test(val)) {
      setIsVideo(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#24272d] border border-[#3b424e] rounded-xl w-full max-w-md shadow-2xl overflow-hidden text-[#d4d8e2] text-xs font-sans">
        {/* Header */}
        <div className="h-9 px-4 bg-[#1e2126] border-b border-[#323843] flex items-center justify-between select-none">
          <div className="flex items-center space-x-2">
            <Link2 size={14} className="text-blue-400" />
            <span className="font-medium text-white">{t.title}</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#8e95a5] hover:text-white p-1 rounded hover:bg-[#343a46] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          <div className="space-y-1">
            <label className="text-[#8e95a5] font-medium">{t.urlLabel}</label>
            <input
              type="url"
              required
              autoFocus
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[#181a1e] border border-[#343a46] rounded-md px-3 py-1.5 text-xs text-white placeholder-[#6f7787] focus:outline-none focus:border-blue-500 font-mono transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[#8e95a5] font-medium">{t.nameLabel}</label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="example.zip"
              className="w-full bg-[#181a1e] border border-[#343a46] rounded-md px-3 py-1.5 text-xs text-white placeholder-[#6f7787] focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isVideo}
                onChange={(e) => setIsVideo(e.target.checked)}
                className="rounded bg-[#181a1e] border-[#343a46] text-blue-600 focus:ring-0"
              />
              <span className="text-[#cfd3dc]">{t.isVideo}</span>
            </label>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#323843]">
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
              {t.start}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
