import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    const path = error instanceof TRPCClientError ? (error as TRPCClientError & { data?: { path?: string } }).data?.path : "";
    if (typeof path === "string" && path.includes("pushNotifications")) return;
    console.error("[API Mutation Error]", error);
  }
});

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const trpcUrl = apiBaseUrl ? `${apiBaseUrl}/api/trpc` : "/api/trpc";

const FETCH_TIMEOUT_MS = 30000;

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return globalThis
    .fetch(input, {
      ...(init ?? {}),
      credentials: "include",
      signal: ctrl.signal,
    })
    .finally(() => clearTimeout(timeout));
}

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: (op) => op.type === "mutation",
      true: httpLink({
        url: trpcUrl,
        transformer: superjson,
        fetch: fetchWithTimeout,
      }),
      false: httpBatchLink({
        url: trpcUrl,
        transformer: superjson,
        fetch(input, init) {
          return globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });
        },
      }),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(registration => {
        let refreshing = false;
        let updateNotified = false;

        const notifyUpdateAvailable = () => {
          if (updateNotified) return;
          updateNotified = true;
          window.dispatchEvent(new CustomEvent("timeclock-update-available"));
        };

        const activateUpdate = () => {
          if (registration.waiting) {
            notifyUpdateAvailable();
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        };

        // If there is already an update waiting, activate it now.
        activateUpdate();

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            // A new service worker is installed and ready to take control.
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              notifyUpdateAvailable();
              activateUpdate();
            }
          });
        });

        // Check for updates periodically so deployed changes arrive automatically.
        setInterval(() => {
          registration.update().catch(() => {
            // ignore background update errors
          });
        }, 60 * 1000);

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      })
      .catch(error => {
        console.warn("[PWA] Service worker registration failed:", error);
      });
  });
}
