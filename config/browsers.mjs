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

// Retain classic media-query syntax for WebKit ports whose resize handling
// does not update equivalent range queries consistently.
export const cssCompilerOptions = { targets: cssTargets, include: Features.MediaQueries };
