import { Loader2 } from "lucide-react"
import type React from "react"
import type { ReactNode } from "react"

interface QueryStateViewProps {
  isLoading: boolean
  isError?: boolean
  isEmpty: boolean
  children: ReactNode
  empty: ReactNode
  error?: ReactNode
  loadingClassName?: string
  errorClassName?: string
  emptyClassName?: string
  loadingSize?: number
}

export const QueryStateView: React.FC<QueryStateViewProps> = ({
  isLoading,
  isError = false,
  isEmpty,
  children,
  empty,
  error,
  loadingClassName = "flex justify-center p-12 text-cyan-300",
  errorClassName = "text-center py-12 text-red-300 font-mono",
  emptyClassName = "text-center py-16 text-cyan-300/70 font-mono text-sm",
  loadingSize = 32,
}) => {
  if (isLoading) {
    return (
      <div className={loadingClassName} role="status" aria-label="Loading">
        <Loader2 size={loadingSize} className="animate-spin" />
      </div>
    )
  }

  if (isError) {
    return <div className={errorClassName}>{error}</div>
  }

  if (isEmpty) {
    return <div className={emptyClassName}>{empty}</div>
  }

  return <>{children}</>
}
