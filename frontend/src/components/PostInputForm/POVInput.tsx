import React, { useRef, useState, useEffect } from "react"
import { suggestPOVs } from "../../api/client"
import { validatePOV } from "../../utils/security"
import { POV_CONSTRAINTS, DEBOUNCE_DELAYS } from "../../types/constants"

interface POVInputProps {
  manualPOVs: string[]
  onAddPOV: (pov: string) => void
  onRemovePOV: (pov: string) => void
}

export const POVInput: React.FC<POVInputProps> = ({
  manualPOVs,
  onAddPOV,
  onRemovePOV: _onRemovePOV,
}) => {
  const [manualPOVInput, setManualPOVInput] = useState<string>("")
  const [povSuggestions, setPOVSuggestions] = useState<string[]>([])
  const [showPOVSuggestions, setShowPOVSuggestions] = useState(false)
  const povInputRef = useRef<HTMLInputElement>(null)

  // POV suggestions for manual input
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const query = manualPOVInput.trim()
        const suggestions = await suggestPOVs(query)
        setPOVSuggestions(suggestions)
        if (povInputRef.current === document.activeElement) {
          setShowPOVSuggestions(suggestions.length > 0)
        }
      } catch (error) {
        console.error("Failed to get POV suggestions", error)
        setPOVSuggestions([])
        setShowPOVSuggestions(false)
      }
    }, DEBOUNCE_DELAYS.POV_SUGGESTION)

    return () => clearTimeout(timer)
  }, [manualPOVInput])

  const addManualPOV = () => {
    let trimmed = manualPOVInput.trim()
    if (trimmed.startsWith("#")) {
      trimmed = trimmed.slice(1).trim()
    }
    if (!trimmed || manualPOVs.includes(trimmed)) return
    
    // Validate POV
    const validation = validatePOV(trimmed)
    if (!validation.valid) {
      alert(validation.error)
      return
    }
    
    onAddPOV(trimmed)
    setManualPOVInput("")
  }

  const handlePOVSuggestionClick = (pov: string) => {
    if (!manualPOVs.includes(pov)) {
      onAddPOV(pov)
    }
    setManualPOVInput("")
    setShowPOVSuggestions(false)
    povInputRef.current?.focus()
  }

  return (
    <div className="pt-2 border-t border-cyan-500/15 relative">
      <div className="flex gap-2 items-center">
        <span className="text-fuchsia-300 text-sm font-mono">#</span>
        <div className="flex-1 relative">
          <input
            ref={povInputRef}
            type="text"
            value={manualPOVInput}
            maxLength={POV_CONSTRAINTS.MAX_LENGTH}
            onChange={(e) => {
              let value = e.target.value
              if (value.startsWith("#")) {
                value = value.slice(1)
              }
              if (value.length > POV_CONSTRAINTS.MAX_LENGTH) {
                value = value.slice(0, POV_CONSTRAINTS.MAX_LENGTH)
              }
              setManualPOVInput(value)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                if (showPOVSuggestions && povSuggestions.length > 0 && !manualPOVInput.trim()) {
                  handlePOVSuggestionClick(povSuggestions[0])
                } else {
                  addManualPOV()
                }
              } else if (e.key === "Escape") {
                setShowPOVSuggestions(false)
              } else if (e.key === "ArrowDown") {
                e.preventDefault()
                if (povSuggestions.length > 0) {
                  setShowPOVSuggestions(true)
                }
              }
            }}
            onFocus={async () => {
              if (povSuggestions.length > 0) {
                setShowPOVSuggestions(true)
              } else {
                try {
                  const suggestions = await suggestPOVs("")
                  setPOVSuggestions(suggestions)
                  setShowPOVSuggestions(suggestions.length > 0)
                } catch (error) {
                  console.error("Failed to get POV suggestions", error)
                }
              }
            }}
            onBlur={() => {
              setTimeout(() => setShowPOVSuggestions(false), 200)
            }}
            placeholder="ADD POV (ENTER TO ADD, MAX 300 CHARS)"
            className="w-full px-2 py-1.5 bg-[#2a2a50] rounded border border-fuchsia-500/25 focus:ring-1 focus:ring-fuchsia-500/30 focus:border-fuchsia-500/40 text-fuchsia-300 placeholder:text-fuchsia-400/60 text-xs font-mono transition-all"
          />
          {manualPOVInput.length > 250 && (
            <div className="absolute top-full left-0 right-0 mt-1 text-xs text-fuchsia-400/60 px-2 font-mono">
              {manualPOVInput.length}/{POV_CONSTRAINTS.MAX_LENGTH} CHARACTERS
            </div>
          )}
          {showPOVSuggestions && povSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1f1f35] border border-fuchsia-500/18 rounded-lg z-50 max-h-48 overflow-y-auto">
              {manualPOVInput.trim() ? (
                <div className="px-3 py-2 text-xs text-fuchsia-400/60 border-b border-fuchsia-500/12 font-mono">
                  SUGGESTIONS FOR &quot;{manualPOVInput}&quot;
                </div>
              ) : (
                <div className="px-3 py-2 text-xs text-fuchsia-400/60 border-b border-fuchsia-500/12 font-mono">
                  POPULAR POVS
                </div>
              )}
              {povSuggestions.map((pov) => (
                <button
                  key={pov}
                  type="button"
                  onClick={() => handlePOVSuggestionClick(pov)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-fuchsia-300 hover:bg-fuchsia-900/20 transition-colors flex items-center gap-2 font-mono"
                >
                  <span className="text-fuchsia-400">#</span>
                  <span className="flex-1">{pov}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
