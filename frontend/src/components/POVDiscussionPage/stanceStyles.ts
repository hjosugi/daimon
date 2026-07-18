import type { LucideIcon } from "lucide-react"
import { CircleAlert, CircleHelp, Heart, MessageCircle } from "lucide-react"
import type { POVCommentStance } from "../../api/client"

export const stanceClasses: Record<POVCommentStance, string> = {
  support: "border-emerald-500/30 bg-emerald-900/20 text-emerald-200",
  question: "border-cyan-500/30 bg-cyan-900/20 text-cyan-200",
  oppose: "border-rose-500/30 bg-rose-900/20 text-rose-200",
  note: "border-fuchsia-500/30 bg-fuchsia-900/20 text-fuchsia-200",
}

export const stanceBarColors: Record<POVCommentStance, string> = {
  support: "bg-emerald-400/80",
  question: "bg-cyan-400/80",
  oppose: "bg-rose-400/80",
  note: "bg-fuchsia-400/80",
}

export const stanceIcons: Record<POVCommentStance, LucideIcon> = {
  support: Heart,
  question: CircleHelp,
  oppose: CircleAlert,
  note: MessageCircle,
}

export const stanceOrder: POVCommentStance[] = [
  "support",
  "question",
  "oppose",
  "note",
]
