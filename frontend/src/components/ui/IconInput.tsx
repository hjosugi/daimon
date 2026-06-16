import type React from "react"

interface IconInputProps {
  id: string
  label: string
  icon: React.ReactNode
  value: string
  onChange?: (value: string) => void
  type?: React.HTMLInputTypeAttribute
  required?: boolean
  disabled?: boolean
  placeholder?: string
  labelClassName?: string
  inputClassName?: string
}

export const IconInput: React.FC<IconInputProps> = ({
  id,
  label,
  icon,
  value,
  onChange,
  type = "text",
  required = false,
  disabled = false,
  placeholder,
  labelClassName = "block text-xs font-medium text-cyan-300/95 mb-1 font-mono",
  inputClassName = "w-full pl-10 pr-4 py-2 bg-[#2a2a50] border border-cyan-500/15 rounded focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/40 text-cyan-300 placeholder:text-cyan-300/80 font-mono transition-all",
}) => (
  <div>
    <label htmlFor={id} className={labelClassName}>
      {label}
    </label>
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-300/70">
        {icon}
      </div>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        required={required}
        disabled={disabled}
        className={inputClassName}
        placeholder={placeholder}
      />
    </div>
  </div>
)
