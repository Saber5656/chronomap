# Title

Implement long-press point picker ("time travel here")

## Summary

Wire the map long-press gesture (10) to a context menu: drop a temporary picked-point marker,
"ここを起点に時間旅行" (recenter + URL update), and "地図アプリで開く" (32's menu).

## Context

DESIGN §3.5/§8 #2. Gives integration parity for arbitrary points (not just POIs and current
location) — the inbound counterpart lands via share/import; this is the in-app picker.

## Scope

- `src/app/pointPicker.ts`: subscribes `mapController.onLongPress(lngLat)`:
  - Validate coords (§12.3), drop marker (GeoJSON source `chronomap-picked`, distinct pin style),
    open anchored action popover:
    1. i18n `picker.travelHere` (`ここを起点に時間旅行`) → `actions.setView({lat,lng,zoom:
       max(current,15)})` → URL sync picks it up; popover closes; marker persists until map tap.
    2. i18n `picker.openInMaps` → 32's `showMapHandoffMenu(lat,lng)`.
    3. i18n `picker.copyCoords` (`座標をコピー`) → clipboard `{lat},{lng}` + toast.
  - Dismissal: outside tap / Esc / map move → remove marker + popover.
- Marker style: hollow ring pin, distinct from POI pins and user-location dot.
- Desktop parity: `contextmenu` triggers the same flow (10 already emits).

## Detailed Requirements

1. Long-press during pinch/pan must not fire (10's gesture guard; add e2e regression here).
2. Only one picked point at a time; new long-press replaces.
3. The picked point is ephemeral: never serialized to URL (only the recenter action changes URL),
   never stored.
4. Popover placement: anchored to screen point, flipped near edges, within safe areas.

## Acceptance Criteria

- [ ] e2e (touch): long-press empty map area → marker + popover; "travel here" recenters ≥z15 and
      updates URL after settle; marker cleared on map tap.
- [ ] e2e: "copy coords" puts `35.681236,139.767125`-format text on clipboard + toast.
- [ ] e2e: pan gesture does not open the popover (regression).
- [ ] Unit: popover placement flip logic (pure geometry helper).

## Validation

`tests/e2e/picker.spec.ts`.

## Dependencies

10 (long-press event), 12 (URL sync), 32 (handoff menu).

## Non-goals

Reverse geocoding (showing an address — v2 with geocoding), persistent pins/bookmarks (v2),
label editing.

## Design References

DESIGN §3.5, §8 #2/#11; §12.3.
