import apiService from './api.js';

export async function initUpdater() {
  // This app has no bundler, so npm packages can't be imported by bare
  // specifier (e.g. "@capgo/capacitor-updater") — the browser has no way
  // to resolve that to a file on disk. Capacitor's native bridge instead
  // exposes every registered plugin on window.Capacitor.Plugins at
  // runtime, which works fine with plain relative-path ES modules.
  // window.Capacitor only exists inside the native app shell (not a plain
  // desktop browser tab, e.g. when testing via `npx serve`), so bail out
  // cleanly if it's missing.
  const Capacitor = window.Capacitor;
  if (!Capacitor?.isNativePlatform?.()) return;

  const { CapacitorUpdater, SplashScreen } = Capacitor.Plugins;
  if (!CapacitorUpdater) {
    console.warn('[otaUpdater] CapacitorUpdater plugin not found — was `npx cap sync` run after install?');
    return;
  }

  // Required every launch — skipping this triggers an automatic rollback
  await CapacitorUpdater.notifyAppReady();

  try {
    const current = await CapacitorUpdater.current();

    // GET request: apiService won't require CSRF/auth for this,
    // but will attach a bearer token automatically if the user is logged in.
    const info = await apiService.get(
      `/mobile/updates/latest?current=${encodeURIComponent(current.bundle.version)}`
    );

    if (!info?.hasUpdate || !info.url) return;

    const bundle = await CapacitorUpdater.download({
      version: info.version,
      url: info.url,
      checksum: info.checksum, // sha256 — plugin verifies natively, download fails on mismatch
    });

    await CapacitorUpdater.next({ id: bundle.id });

    if (info.mandatory) {
      await SplashScreen?.show();
      await CapacitorUpdater.set({ id: bundle.id }); // apply now, reloads app
    }
  } catch (err) {
    console.error('[otaUpdater] check failed', err);
    // Never throw — a broken update check must not break the running app
  }
}
