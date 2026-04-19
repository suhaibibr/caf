"use client";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "تأكيد الحذف",
  cancelLabel = "إلغاء",
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/28 p-4 backdrop-blur-sm dark:bg-[#05070D]/78">
      <div className="w-full max-w-md rounded-[28px] border border-[color:var(--page-line)] bg-[var(--dialog-bg)] p-6 text-[var(--dialog-text)] shadow-[0_32px_120px_rgba(0,0,0,0.22)] dark:shadow-[0_32px_120px_rgba(0,0,0,0.52)]">
        <div className="text-right">
          <p className="text-[11px] font-bold tracking-[0.18em] text-[var(--page-soft)]">
            تأكيد الإجراء
          </p>
          <h3 className="mt-3 text-2xl font-bold leading-[1.2] text-[var(--page-fg)]">
            {title}
          </h3>
          <p className="mt-4 text-sm font-bold leading-7 text-[var(--page-muted)]">
            {description}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex h-12 items-center justify-center rounded-full border border-[color:var(--page-line)] bg-[var(--page-surface-soft)] px-4 text-sm font-bold text-[var(--page-fg)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex h-12 items-center justify-center rounded-full border border-[#D96C6C]/24 bg-[linear-gradient(135deg,#E87777,#B84B4B)] px-4 text-sm font-bold text-white shadow-[0_12px_36px_rgba(0,0,0,0.36)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "جارٍ الحذف..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
