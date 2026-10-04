// A dynamic import no bundler can see: Next/Turbopack otherwise folds `import(expr)` into a context of every
// matching package in node_modules and tries to bundle wasm-pack glue and optional SDK deps.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const opaqueImport = new Function("specifier", "return import(specifier)") as (s: string) => Promise<unknown>;
export function importAtRuntime<T = unknown>(specifier: string): Promise<T> {
  return opaqueImport(specifier) as Promise<T>;
}
