import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useI18n } from "../../i18n"

type ToastVariant = "error"

interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  showError: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)
const TOAST_TIMEOUT_MS = 5000

function createToastId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<number[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showError = useCallback(
    (message: string) => {
      const id = createToastId()
      setToasts((current) => [
        { id, message, variant: "error" },
        ...current.slice(0, 3),
      ])
      const timer = window.setTimeout(() => removeToast(id), TOAST_TIMEOUT_MS)
      timersRef.current.push(timer)
    },
    [removeToast],
  )

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current) {
        window.clearTimeout(timer)
      }
    }
  }, [])

  const value = useMemo(() => ({ showError }), [showError])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-[80] flex w-[min(92vw,360px)] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.variant === "error" ? "alert" : "status"}
            className="rounded border border-red-500/35 bg-[#2a1622] px-3 py-2 text-sm text-red-100 shadow-lg shadow-black/30"
          >
            <div className="flex items-start gap-2">
              <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-red-400" />
              <p className="min-w-0 flex-1 break-words font-mono leading-relaxed">
                {toast.message}
              </p>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="rounded px-1 text-red-100/70 hover:bg-red-500/15 hover:text-red-50"
                aria-label={t("toast.close")}
                title={t("toast.close")}
              >
                x
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return value
}
