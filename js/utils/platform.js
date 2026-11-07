export function isIOS() {
  const ua = navigator.userAgent || "";
  const iPhoneOrIPod = /iPhone|iPod/.test(ua);
  const iPad = /iPad/.test(ua);

  // iPadOS 13+ reports itself as a Mac, but a real Mac has no touch screen
  const modernIPad =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  return iPhoneOrIPod || iPad || modernIPad;
}
