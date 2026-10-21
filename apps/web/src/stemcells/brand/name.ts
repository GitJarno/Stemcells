/**
 * The app's name, wherever a person reads it (`stemcells/brand/name.ts`, the
 * one place it's written). Upstream's `APP_BASE_NAME` falls back to it when
 * no desktop app names itself (a browser), and the desktop app names itself
 * the same in `DesktopEnvironment.ts`; `upstream/appName.contract.test.ts`
 * keeps the two equal.
 */
export { APP_NAME } from "../../../../../stemcells/brand/name.ts";
