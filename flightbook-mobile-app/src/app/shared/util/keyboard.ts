/**
 * Keyboard geometry for Ionic's scroll assist.
 *
 * Keyboard.resize is "none" (capacitor.config.json): the keyboard overlays the
 * webview, and tokens.scss lifts ion-footer (the forms' Save button) on top of
 * it. When a field is focused, Ionic decides whether to scroll it into view from
 * its `keyboardHeight` config - a fixed estimate (default 290), read once at
 * startup, that knows nothing about the lifted footer. A field sitting in the
 * band the estimate misses (flight form: km) was judged visible and ended up
 * under the keyboard and the Save button.
 *
 * So the estimate is the real keyboard height last seen on this device plus the
 * footer that rides on it. Pages without a footer just scroll a little further.
 *
 * iOS only: `resize` is an iOS-only setting. On Android the webview still
 * shrinks for the keyboard (resizeOnFullScreen), the footer already sits on it,
 * and lifting it again would leave it floating a keyboard-height too high.
 */

import { Capacitor } from '@capacitor/core';

/** True where the keyboard covers the webview instead of shrinking it. */
export const keyboardOverlaysWebview = (): boolean => Capacitor.getPlatform() === 'ios';

const STORAGE_KEY = 'keyboard_height';

/** Typical iPhone portrait keyboard with the suggestion bar, until one is measured. */
const DEFAULT_KEYBOARD_HEIGHT = 336;

/** .form-footer: 10px + 50px button + 12px padding + 1px border. */
const FOOTER_HEIGHT = 73;

export function rememberKeyboardHeight(height: number): void {
    if (height > 0) {
        localStorage.setItem(STORAGE_KEY, String(Math.round(height)));
    }
}

/** The value for Ionic's `keyboardHeight` config. */
export function scrollAssistKeyboardHeight(): number {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    const keyboard = stored > 0 ? stored : DEFAULT_KEYBOARD_HEIGHT;
    return keyboard + FOOTER_HEIGHT;
}
