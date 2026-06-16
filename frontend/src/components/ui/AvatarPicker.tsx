import { Image as ImageIcon, User as UserIcon } from "lucide-react"
import type React from "react"

interface AvatarPickerProps {
  id: string
  preview: string | null
  onFileSelect: (file: File) => void
  fallback?: "image" | "user"
  size?: "md" | "lg"
  helpText?: string
  removeLabel?: string
  onRemove?: () => void
  showEditBadge?: boolean
}

const sizeClasses = {
  md: "w-20 h-20",
  lg: "w-24 h-24 sm:w-28 sm:h-28",
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({
  id,
  preview,
  onFileSelect,
  fallback = "image",
  size = "md",
  helpText,
  removeLabel,
  onRemove,
  showEditBadge = false,
}) => {
  const FallbackIcon = fallback === "user" ? UserIcon : ImageIcon

  return (
    <div className="flex flex-col items-center gap-2">
      <label htmlFor={id} className="cursor-pointer">
        <div className="relative">
          <div
            className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-cyan-400/80 to-fuchsia-400/80 flex items-center justify-center overflow-hidden border-2 border-cyan-500/18`}
          >
            {preview ? (
              <img
                src={preview}
                alt="Avatar preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <FallbackIcon
                size={size === "lg" ? 40 : 32}
                className="text-black"
              />
            )}
          </div>
          {showEditBadge && (
            <div className="absolute bottom-0 right-0 bg-cyan-500/90 text-black rounded-full p-2 hover:bg-cyan-400 transition-colors border border-cyan-400/50">
              <ImageIcon size={16} />
            </div>
          )}
        </div>
        <input
          id={id}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFileSelect(file)
            e.currentTarget.value = ""
          }}
          className="hidden"
        />
      </label>
      {removeLabel && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-cyan-300/80 hover:text-cyan-300/95 px-3 py-1.5 bg-cyan-900/10 border border-cyan-500/12 rounded hover:bg-cyan-900/20 transition-colors font-mono"
        >
          {removeLabel}
        </button>
      )}
      {helpText && (
        <span className="text-xs text-cyan-300/70 text-center font-mono">
          {helpText}
        </span>
      )}
    </div>
  )
}
