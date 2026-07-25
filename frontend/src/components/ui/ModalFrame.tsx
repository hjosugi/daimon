import { X } from "lucide-react"
import type React from "react"
import { useEffect, useId, useRef } from "react"
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
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = "hidden"
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    const panel = panelRef.current
    panel?.focus()

    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",")

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== "Tab" || !panel) return

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((item) => item.offsetParent !== null)

      if (focusable.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`modal-surface relative z-10 bg-[#0f0f1f] rounded-xl border border-cyan-500/18 w-full ${maxWidthClassName} mx-auto overflow-hidden max-h-[90vh] overflow-y-auto`}
      >
        <div
          className={`${headerClassName} border-b p-4 flex items-center justify-between`}
        >
          <h2
            id={titleId}
            className="text-xl font-bold text-cyan-200/95 font-mono"
          >
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
