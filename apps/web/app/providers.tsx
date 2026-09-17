'use client';
// TanStack Query provider. The only reason this file is a client boundary.
//
// TODO: useState(() => new QueryClient({ defaultOptions: { queries: {
//         staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }))
//       — created in state, not at module scope, or every server render shares one cache.
// TODO: wrap children in QueryClientProvider.

export default function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
