/**
 * Loaded before the app (see `polyfills` in angular.json).
 *
 * No Zone.js: the app runs zoneless (provideZonelessChangeDetection in
 * main.ts), so change detection is driven by signals, template events,
 * markForCheck() and the async pipe - not by patched browser APIs.
 */

// Add global to window, assigning the value of window itself.
(window as any).global = window;
