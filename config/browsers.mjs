import { Features } from 'lightningcss';

// Shared compilation targets; the browser test matrix runs all three engines.
export const supportedBrowsers = { chrome: [109], firefox: [115], safari: [16, 4] };
export const buildTargets = Object.entries(supportedBrowsers).map(
  ([name, version]) => name + version.join('.')
);
export const cssTargets = Object.fromEntries(
  Object.entries(supportedBrowsers).map(([name, [major, minor = 0]]) => [
    name,
    (major << 16) | (minor << 8),
  ])
);

// Use classic media-query syntax consistently across browser ports.
export const cssCompilerOptions = { targets: cssTargets, include: Features.MediaQueries };
