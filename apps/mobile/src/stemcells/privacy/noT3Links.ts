/**
 * Upstream's phone claims the thread links of T3's hosted web app (`app.t3.codes`). Claiming
 * a host has the phone fetch its `.well-known` file at install, Android straight from the
 * phone, and Stemcells never uses T3's hosted app, so its build claims none of it.
 */
import type { ExpoConfig } from "expo/config";

const T3_HOSTED_APP = "app.t3.codes";

/** `config` without the iOS associated domains and Android link filters for T3's hosted app. */
export function withoutT3AppLinks(config: ExpoConfig): ExpoConfig {
  const { ios, android } = config;
  return {
    ...config,
    ios: ios && {
      ...ios,
      associatedDomains: ios.associatedDomains?.filter(
        (domain) => domain.split(":")[1] !== T3_HOSTED_APP,
      ),
    },
    android: android && {
      ...android,
      intentFilters: android.intentFilters?.filter(
        (filter) => ![filter.data ?? []].flat().some((data) => data.host === T3_HOSTED_APP),
      ),
    },
  };
}
