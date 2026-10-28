import React, { useEffect } from "react";

interface ConfirmModalProps {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ message, confirmLabel, cancelLabel, onConfirm, onCancel }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center modal-perde" onMouseDown={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-[360px] max-w-[90vw] bg-[#22252b] border border-[#343a46] rounded-xl p-4 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-white mb-4">{message}</p>
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-md border border-[#343a46] text-[#c5cad6] hover:bg-[#2c374d]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-500"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
