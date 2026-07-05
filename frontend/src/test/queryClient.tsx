import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { ToastProvider } from "../components/ui/ToastProvider"
import { I18nProvider } from "../i18n"

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Number.POSITIVE_INFINITY,
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export function createQueryClientWrapper(
  queryClient = createTestQueryClient(),
) {
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </QueryClientProvider>
    ),
  }
}
