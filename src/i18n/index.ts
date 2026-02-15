/**
 * BDD Guardian i18n – runtime messages in English and Spanish.
 * Language is chosen via setting bddGuardian.displayLanguage or VS Code display language.
 */

import * as vscode from 'vscode';
import { en, es } from './messages';

export type DisplayLanguage = 'en' | 'es';

const bundles: Record<DisplayLanguage, Record<string, string>> = { en, es };

function getDisplayLanguage(): DisplayLanguage {
  try {
    const config = vscode.workspace.getConfiguration('bddGuardian');
    const setting = config.get<DisplayLanguage | ''>('displayLanguage', '');
    if (setting === 'en' || setting === 'es') {
      return setting;
    }
    const vsCodeLang = (vscode.env.language || 'en').toLowerCase();
    if (vsCodeLang.startsWith('es')) return 'es';
    return 'en';
  } catch {
    return 'en';
  }
}

let currentLang: DisplayLanguage = 'en';

/**
 * Returns the current display language (for tests or UI that needs to know).
 */
export function getCurrentLanguage(): DisplayLanguage {
  return currentLang;
}

/**
 * Refreshes the language from settings (call when configuration changes).
 */
export function refreshLanguage(): void {
  currentLang = getDisplayLanguage();
}

/**
 * Translates a key and optionally substitutes {0}, {1}, … with the given arguments.
 * Falls back to the key if the key is missing in the bundle.
 */
export function t(key: string, ...args: string[]): string {
  const bundle = bundles[currentLang] ?? en;
  let msg = bundle[key] ?? (en as Record<string, string>)[key] ?? key;
  args.forEach((arg, i) => {
    msg = msg.replace(new RegExp(`\\{${i}\\}`, 'g'), arg);
  });
  return msg;
}

// Initialize on load
refreshLanguage();
