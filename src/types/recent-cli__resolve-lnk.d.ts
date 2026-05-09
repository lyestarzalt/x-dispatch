// @recent-cli/resolve-lnk ships pure JS without a .d.ts. This ambient
// module declaration covers the surface we use:
//   - resolveBuffer: parse a .lnk Buffer (used by buildLnkFixture tests)
//   - resolve:       parse a .lnk file path (used by the resolveLnkSync wrapper)
//
// Kept as a script (no top-level imports/exports) so the `declare module`
// block stays an ambient module declaration rather than a module
// augmentation.
declare module '@recent-cli/resolve-lnk' {
  export function resolveBuffer(buf: Buffer): string;
  export function resolve(path: string): Promise<string>;
  export class ResolveLnkException extends Error {
    bag: unknown;
    error: unknown;
  }
}
