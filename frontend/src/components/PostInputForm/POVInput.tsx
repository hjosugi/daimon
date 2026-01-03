import React, { useRef, useState, useEffect } from "react"
import { suggestPOVs } from "../../api/client"
import { validatePOV } from "../../utils/security"
import { POV_CONSTRAINTS, DEBOUNCE_DELAYS } from "../../types/enums"

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
    <div className="pt-2 border-t border-slate-100 relative">
      <div className="flex gap-2 items-center">
        <span className="text-slate-400 text-sm">#</span>
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
            placeholder="Add POV (Enter to add, max 300 chars)"
            className="w-full px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-slate-700 placeholder:text-slate-400 text-sm"
          />
          {manualPOVInput.length > 250 && (
            <div className="absolute top-full left-0 right-0 mt-1 text-xs text-slate-500 px-2">
              {manualPOVInput.length}/{POV_CONSTRAINTS.MAX_LENGTH} characters
            </div>
          )}
          {showPOVSuggestions && povSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
              {manualPOVInput.trim() ? (
                <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">
                  Suggestions for &quot;{manualPOVInput}&quot;
                </div>
              ) : (
                <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">
                  Popular POVs
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
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 transition-colors flex items-center gap-2"
                >
                  <span className="text-blue-600">#</span>
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
