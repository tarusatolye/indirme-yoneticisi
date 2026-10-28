import React, { useState } from "react";
import {
  Folder,
  Image as ImageIcon,
  Music,
  Film,
  LayoutGrid,
  FileText,
  Archive,
  File,
  CheckCircle2,
  History,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Trash2,
} from "lucide-react";
import { FileCategory, DownloadItem } from "../types";
import { translations } from "../i18n";

interface SidebarProps {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  items: DownloadItem[];
  lang: "tr" | "en";
  onClearFinished?: () => void;
  onClearUnfinished?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedCategory,
  onSelectCategory,
  items,
  lang,
  onClearFinished,
  onClearUnfinished,
}) => {
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const t = translations[lang];

  const getCount = (filter: string) => {
    if (filter === "all") return items.length;
    if (filter === "finished") return items.filter((i) => i.state === "completed").length;
    if (filter === "unfinished") return items.filter((i) => i.state !== "completed").length;
    return items.filter((i) => i.category === filter).length;
  };

  const categories: { id: FileCategory; label: string; icon: React.ReactNode }[] = [
    { id: "image", label: t.sidebar.image, icon: <ImageIcon size={15} /> },
    { id: "music", label: t.sidebar.music, icon: <Music size={15} /> },
    { id: "video", label: t.sidebar.video, icon: <Film size={15} /> },
    { id: "apps", label: t.sidebar.apps, icon: <LayoutGrid size={15} /> },
    { id: "document", label: t.sidebar.document, icon: <FileText size={15} /> },
    { id: "compressed", label: t.sidebar.compressed, icon: <Archive size={15} /> },
    { id: "other", label: t.sidebar.other, icon: <File size={15} /> },
  ];

  const allCount = getCount("all");
  const finishedCount = getCount("finished");
  const unfinishedCount = getCount("unfinished");

  return (
    <aside className="w-56 bg-[#212429] border-r border-[#16181b] flex flex-col select-none text-[#cfd3dc] text-[13px] font-sans">
      {/* Sidebar header toggle */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-[#16181b] text-[#8e95a5]">
        <span className="text-xs font-medium opacity-60">
          {t.sidebar.library}
        </span>
        <button className="hover:text-white transition-colors">
          <PanelLeftClose size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {/* All Group Header */}
        <div
          onClick={() => onSelectCategory("all")}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
            selectedCategory === "all"
              ? "bg-[#333a46] text-white font-medium"
              : "hover:bg-[#282c33] text-[#cfd3dc]"
          }`}
        >
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCategoriesOpen(!categoriesOpen);
              }}
              className="text-[#8e95a5] hover:text-white p-0.5"
            >
              {categoriesOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
            <Folder size={16} className="text-[#8e95a5]" />
            <span>{t.sidebar.all}</span>
          </div>
          {allCount > 0 && (
            <span className="text-xs text-[#8e95a5] font-mono">{allCount}</span>
          )}
        </div>

        {/* Subcategories (Indented) */}
        {categoriesOpen && (
          <div className="pl-6 space-y-0.5">
            {categories.map((cat) => {
              const count = getCount(cat.id);
              const isSelected = selectedCategory === cat.id;
              return (
                <div
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-[#333a46] text-white font-medium"
                      : "hover:bg-[#282c33] text-[#a9b0c0]"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="text-[#8e95a5]">{cat.icon}</span>
                    <span>{cat.label}</span>
                  </div>
                  {count > 0 && (
                    <span className="text-xs text-[#8e95a5] font-mono">{count}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Separator */}
        <div className="pt-2 pb-1">
          <div className="h-px bg-[#2d323b] mx-2" />
        </div>

        {/* Finished */}
        <div
          onClick={() => onSelectCategory("finished")}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-colors group ${
            selectedCategory === "finished"
              ? "bg-[#333a46] text-white font-medium"
              : "hover:bg-[#282c33] text-[#cfd3dc]"
          }`}
        >
          <div className="flex items-center space-x-2.5 pl-4">
            <CheckCircle2 size={15} className="text-[#8e95a5]" />
            <span>{t.sidebar.finished}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            {finishedCount > 0 && onClearFinished && (
              <button
                title={t.toolbar.clearFinished}
                onClick={(e) => {
                  e.stopPropagation();
                  onClearFinished();
                }}
                className="tarus-satir-islem p-0.5 hover:text-red-400 text-[#8e95a5] rounded"
              >
                <Trash2 size={12} />
              </button>
            )}
            {finishedCount > 0 && (
              <span className="text-xs text-[#8e95a5] font-mono">{finishedCount}</span>
            )}
          </div>
        </div>

        {/* Unfinished */}
        <div
          onClick={() => onSelectCategory("unfinished")}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-colors group ${
            selectedCategory === "unfinished"
              ? "bg-[#333a46] text-white font-medium"
              : "hover:bg-[#282c33] text-[#cfd3dc]"
          }`}
        >
          <div className="flex items-center space-x-2.5 pl-4">
            <History size={15} className="text-[#8e95a5]" />
            <span>{t.sidebar.unfinished}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            {unfinishedCount > 0 && onClearUnfinished && (
              <button
                title={t.toolbar.clearUnfinished}
                onClick={(e) => {
                  e.stopPropagation();
                  onClearUnfinished();
                }}
                className="tarus-satir-islem p-0.5 hover:text-red-400 text-[#8e95a5] rounded"
              >
                <Trash2 size={12} />
              </button>
            )}
            {unfinishedCount > 0 && (
              <span className="text-xs text-[#8e95a5] font-mono">{unfinishedCount}</span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
