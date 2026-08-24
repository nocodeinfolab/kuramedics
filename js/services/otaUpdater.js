// js/services/otaUpdater.js
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { SplashScreen } from '@capacitor/splash-screen';
import apiService from './api.js';

export async function initUpdater() {
  // Required every launch — skipping this triggers an automatic rollback
  await CapacitorUpdater.notifyAppReady();

  try {
    const current = await CapacitorUpdater.current();

    // GET request: apiService won't require CSRF/auth for this,
    // but will attach a bearer token automatically if the user is logged in.
    const info = await apiService.get(
      `/mobile/updates/latest?current=${encodeURIComponent(current.bundle.version)}`
    );

    // Expect { hasUpdate: false } when nothing new, to avoid apiService
    // treating "no update" as a thrown error.
    if (!info?.hasUpdate || !info.url) return;

    const bundle = await CapacitorUpdater.download({
      version: info.version,
      url: info.url,
      checksum: info.checksum, // sha256 — plugin verifies natively, download fails on mismatch
    });

    await CapacitorUpdater.next({ id: bundle.id });

    if (info.mandatory) {
      SplashScreen.show();
      await CapacitorUpdater.set({ id: bundle.id }); // apply now, reloads app
    }
  } catch (err) {
    console.error('[otaUpdater] check failed', err);
    // Never throw — a broken update check must not break the running app
  }
}
