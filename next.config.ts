import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export', // static SPA → out/ ; deploy to any static host (see DESIGN.md §6.1)
  reactCompiler: true, // auto-memoization (React Compiler 1.0) — no manual useMemo/useCallback
};

export default nextConfig;
