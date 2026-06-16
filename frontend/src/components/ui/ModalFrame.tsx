import { X } from "lucide-react"
import type React from "react"
import { useI18n } from "../../i18n"

interface ModalFrameProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidthClassName?: string
  headerClassName?: string
}

export const ModalFrame: React.FC<ModalFrameProps> = ({
  title,
  onClose,
  children,
  maxWidthClassName = "max-w-md",
  headerClassName = "bg-[#1f1f3a] border-cyan-500/12",
}) => {
  const { t } = useI18n()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        className={`relative z-10 bg-[#0f0f1f] rounded-lg border border-cyan-500/18 w-full ${maxWidthClassName} mx-auto overflow-hidden max-h-[90vh] overflow-y-auto`}
      >
        <div
          className={`${headerClassName} border-b p-4 flex items-center justify-between`}
        >
          <h2 className="text-xl font-bold text-cyan-200/95 font-mono">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-cyan-300/90 hover:text-cyan-400 hover:bg-cyan-900/10 rounded p-1 transition-colors"
            aria-label={t("common.close")}
            title={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
