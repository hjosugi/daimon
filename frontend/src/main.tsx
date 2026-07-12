import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import ReactDOM from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router-dom"
import App from "./App"
import { ToastProvider } from "./components/ui/ToastProvider"
import { I18nProvider } from "./i18n"
import "./index.css"
import { ThemeProvider } from "./theme"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 30,
    },
  },
})

const router = createBrowserRouter([{ path: "*", element: <App /> }])

// biome-ignore lint/style/noNonNullAssertion: the root element is guaranteed to exist in index.html
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
