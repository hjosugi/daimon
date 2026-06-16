import { AlertTriangle, Trash2 } from "lucide-react"
import type React from "react"
import { useI18n } from "../../i18n"

interface DeleteAccountDialogProps {
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}

export const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({
  isPending,
  onCancel,
  onConfirm,
}) => {
  const { t } = useI18n()

  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-[#0f0f1f] rounded-lg border border-red-500/30 w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-900/30 border border-red-500/30 flex items-center justify-center">
            <AlertTriangle className="text-red-400/90" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-400/90 font-mono">
              {t("profile.deleteAccount")}
            </h3>
            <p className="text-sm text-red-400/60 font-mono">
              {t("profile.deleteWarning")}
            </p>
          </div>
        </div>
        <p className="text-sm text-cyan-300/80 font-mono">
          {t("profile.deleteBody")}
        </p>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 py-2.5 px-4 bg-[#1f1f3a] text-cyan-300/95 border border-cyan-500/12 rounded font-medium hover:bg-[#0f0f1f] hover:border-cyan-500/40 transition-colors disabled:opacity-50 font-mono"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 px-4 bg-red-600/90 text-white rounded font-medium hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-mono font-bold"
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t("common.deleting")}</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>{t("common.delete")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
