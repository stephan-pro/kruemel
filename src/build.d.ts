/** When and from which commit this build was made; `define` in vite.config.ts fills it in. */
declare const __APP_BUILD__: { readonly time: string; readonly commit: string | null };
