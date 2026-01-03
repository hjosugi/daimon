/**
 * Common style constants for consistent theming
 * Colors are brighter with softer contrast while maintaining readability
 */

// Background colors (lighter)
export const bgColors = {
  primary: "bg-[#1a1a2e]", // Slightly lighter than #0f0f1f
  secondary: "bg-[#252540]", // Slightly lighter than #1a1a2f
  card: "bg-[#1f1f35]", // Card background
  hover: "bg-[#2a2a45]", // Hover state
} as const

// Text colors (brighter, better contrast)
export const textColors = {
  primary: "text-cyan-300", // Brighter cyan
  secondary: "text-cyan-200", // Softer cyan
  muted: "text-cyan-400/70", // Muted text
  accent: "text-fuchsia-300", // Brighter fuchsia
  accentMuted: "text-fuchsia-400/80", // Muted fuchsia
  error: "text-red-300", // Brighter red
  success: "text-green-300", // Brighter green
} as const

// Border colors (softer)
export const borderColors = {
  primary: "border-cyan-500/25", // Softer cyan border
  secondary: "border-fuchsia-500/25", // Softer fuchsia border
  hover: "border-cyan-500/40", // Hover border
} as const

// Common class combinations
export const commonStyles = {
  card: `${bgColors.card} rounded-lg border ${borderColors.primary}`,
  input: `${bgColors.secondary} border ${borderColors.primary} focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 ${textColors.primary} placeholder:${textColors.muted}`,
  button: {
    primary: `bg-gradient-to-r from-cyan-500/95 to-fuchsia-500/95 text-black hover:from-cyan-400 hover:to-fuchsia-400`,
    secondary: `${bgColors.secondary} border ${borderColors.primary} hover:${borderColors.hover}`,
  },
  font: "font-mono",
} as const
