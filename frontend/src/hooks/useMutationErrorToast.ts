import { useCallback } from "react"
import { localizedErrorMessage } from "../api/errors"
import { useToast } from "../components/ui/ToastProvider"
import { type TranslationKey, useI18n } from "../i18n"

export function useMutationErrorToast() {
  const { t } = useI18n()
  const { showError } = useToast()

  return useCallback(
    (error: unknown, fallbackKey: TranslationKey) => {
      showError(localizedErrorMessage(error, t(fallbackKey), t))
    },
    [showError, t],
  )
}
