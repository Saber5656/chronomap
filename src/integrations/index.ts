export { parseSharedLocation } from "./parseSharedLocation";
export type { ParseResult, RecognizerId } from "./parseSharedLocation";
export { handleShareRoute, selectShareInput, SHARE_PREFILL_LENGTH } from "./shareRoute";
export type {
  ShareFallback,
  ShareInputSelection,
  ShareRouteOptions,
  ShareRouteOutcome,
} from "./shareRoute";
export {
  buildAppleMapsUrl,
  buildGeoUri,
  buildGoogleMapsUrl,
  mapHandoffTargets,
  openExternal,
  openExternalWithResult,
} from "./outbound";
export type { MapHandoffTarget, OutboundUrl } from "./outbound";
