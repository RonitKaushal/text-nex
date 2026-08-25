/**
 * In-app browser / terminal tab item (per service).
 */
export interface BrowserTabItem {
  id: string;
  url: string;
  title: string;
  /** Optional: ssh terminals use ssh:// URLs */
  kind?: 'webview' | 'ssh';
}
