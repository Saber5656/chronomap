import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useMemo, useRef, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import MapView, { Marker, UrlTile, type LatLng, type Region } from "react-native-maps";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { initialLanguage, STRINGS, type Language } from "./src/i18n";
import {
  attributionLabel,
  createMobileRegistry,
  eraLabel,
  GSI_ATTRIBUTION_URL,
  GSI_PALE_TILE_URL,
  layerTitle,
  MIN_TOUCH_TARGET,
  MOBILE_MAP_MAX_ZOOM,
  MOBILE_MAP_MIN_ZOOM,
  MOBILE_MAP_TILE_SIZE,
  mobileYearRange,
  resolveMobileLayer,
  TOKYO_DEMO_REGION,
  TOKYO_DEMO_YEAR,
  type MobileRegion,
} from "./src/model";

type LocationState = "idle" | "requesting" | "granted" | "denied" | "unavailable";
type NoticeKey = "locationGranted" | "locationDenied" | "locationUnavailable" | "attributionFailed";

const COLORS = {
  ink: "#18342b",
  muted: "#5c7068",
  leaf: "#1f7554",
  leafDark: "#15543d",
  moss: "#b9d7c8",
  paper: "rgba(250, 253, 250, 0.96)",
  line: "rgba(24, 52, 43, 0.14)",
  shadow: "#102a20",
  warning: "#8a4b12",
} as const;

function pressedStyle(pressed: boolean): ViewStyle | undefined {
  return pressed ? styles.pressed : undefined;
}

function ChronomapDemo() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const mapRef = useRef<MapView>(null);
  const currentYear = new Date().getFullYear();
  const registry = useMemo(() => createMobileRegistry(currentYear), [currentYear]);
  const yearRange = useMemo(() => mobileYearRange(registry, currentYear), [currentYear, registry]);

  const [language, setLanguage] = useState<Language>(() => initialLanguage());
  const [year, setYear] = useState(TOKYO_DEMO_YEAR);
  const [opacity, setOpacity] = useState(0.82);
  const [region, setRegion] = useState<MobileRegion>(TOKYO_DEMO_REGION);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [locationCoordinate, setLocationCoordinate] = useState<LatLng | null>(null);
  const [notice, setNotice] = useState<NoticeKey | null>(null);

  const copy = STRINGS[language];
  const selection = useMemo(
    () => resolveMobileLayer({ year, region, viewportWidth: windowWidth, currentYear, registry }),
    [currentYear, region, registry, windowWidth, year],
  );
  const activeLayer = selection.activeLayer;
  const attributionText = attributionLabel(activeLayer, copy.attribution);
  const statusMessage =
    selection.resolution.reason === "registry-empty"
      ? copy.registryError
      : selection.resolution.reason === "no-coverage"
        ? copy.noCoverage
        : selection.resolution.snapped
          ? copy.snapped
          : null;

  const toggleLanguage = () => {
    setLanguage((value) => (value === "ja" ? "en" : "ja"));
  };

  const locate = async () => {
    if (locationState === "requesting") return;
    setNotice(null);
    setLocationCoordinate(null);
    setLocationState("requesting");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationState("denied");
        setNotice("locationDenied");
        return;
      }

      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextRegion: Region = {
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setRegion(nextRegion);
      setLocationCoordinate({ latitude: fix.coords.latitude, longitude: fix.coords.longitude });
      mapRef.current?.animateToRegion(nextRegion, 700);
      setLocationState("granted");
      setNotice("locationGranted");
    } catch {
      setLocationState("unavailable");
      setNotice("locationUnavailable");
    }
  };

  const openAttribution = async () => {
    try {
      await Linking.openURL(activeLayer?.attribution.url ?? GSI_ATTRIBUTION_URL);
    } catch {
      setNotice("attributionFailed");
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={TOKYO_DEMO_REGION}
        mapType={Platform.OS === "android" ? "none" : "standard"}
        minZoomLevel={MOBILE_MAP_MIN_ZOOM}
        maxZoomLevel={MOBILE_MAP_MAX_ZOOM}
        pitchEnabled={false}
        rotateEnabled={false}
        showsCompass={false}
        toolbarEnabled={false}
        onRegionChangeComplete={setRegion}
        accessibilityLabel={copy.intro}
      >
        <UrlTile
          urlTemplate={GSI_PALE_TILE_URL}
          minimumZ={MOBILE_MAP_MIN_ZOOM}
          maximumZ={MOBILE_MAP_MAX_ZOOM}
          tileSize={MOBILE_MAP_TILE_SIZE}
          zIndex={0}
        />
        {activeLayer === null ? null : (
          <UrlTile
            key={activeLayer.id}
            urlTemplate={activeLayer.tiles.urlTemplate}
            minimumZ={activeLayer.tiles.minzoom}
            maximumZ={activeLayer.tiles.maxzoom}
            tileSize={activeLayer.tiles.tileSize}
            opacity={opacity}
            zIndex={1}
          />
        )}
        {locationCoordinate === null ? null : (
          <Marker
            identifier="current-location-fix"
            coordinate={locationCoordinate}
            title={copy.locationMarker}
            pinColor={COLORS.leafDark}
          />
        )}
      </MapView>

      <View
        style={[styles.header, { top: insets.top + 10 }]}
        pointerEvents="box-none"
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <View style={styles.brandCard}>
          <View style={styles.brandMark} accessible={false}>
            <Text style={styles.brandMarkText}>時</Text>
          </View>
          <View style={styles.brandText}>
            <Text style={styles.appName} numberOfLines={1} ellipsizeMode="tail">
              {copy.appName}
            </Text>
            <Text style={styles.demoLabel} numberOfLines={1} ellipsizeMode="tail">
              {copy.demoLabel}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.language}
            hitSlop={8}
            onPress={toggleLanguage}
            style={({ pressed }) => [styles.compactButton, pressedStyle(pressed)]}
          >
            <Text style={styles.compactButtonText}>{copy.language}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.locate}
            accessibilityState={{ busy: locationState === "requesting" }}
            disabled={locationState === "requesting"}
            hitSlop={8}
            onPress={() => void locate()}
            style={({ pressed }) => [
              styles.compactButton,
              styles.locateButton,
              pressedStyle(pressed),
            ]}
          >
            <Text style={styles.locateIcon}>◎</Text>
            <Text style={styles.compactButtonText}>
              {locationState === "requesting" ? copy.locating : copy.locate}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        style={[
          styles.timelineCard,
          {
            bottom: Math.max(insets.bottom, 12),
            left: Math.max(12, (windowWidth - 560) / 2),
            width: Math.min(windowWidth - 24, 560),
            maxHeight: Math.max(
              180,
              Math.min(windowHeight * 0.72, windowHeight - insets.top - headerHeight - 34),
            ),
          },
        ]}
        contentContainerStyle={styles.timelineContent}
      >
        <View style={styles.timelineHeading}>
          <View style={styles.yearBlock}>
            <Text style={styles.eyebrow}>{copy.year}</Text>
            <Text style={styles.yearValue}>{selection.year}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${copy.present} ${currentYear}`}
            onPress={() => setYear(currentYear)}
            style={({ pressed }) => [styles.presentButton, pressedStyle(pressed)]}
          >
            <Text style={styles.presentButtonText}>{copy.present}</Text>
            <Text style={styles.presentButtonYear}>{currentYear}</Text>
          </Pressable>
        </View>

        <Slider
          accessibilityLabel={copy.year}
          accessibilityValue={{
            min: yearRange.minimum,
            max: yearRange.maximum,
            now: selection.year,
            text: String(selection.year),
          }}
          minimumValue={yearRange.minimum}
          maximumValue={yearRange.maximum}
          step={1}
          value={selection.year}
          minimumTrackTintColor={COLORS.leaf}
          maximumTrackTintColor={COLORS.moss}
          thumbTintColor={COLORS.leafDark}
          onValueChange={setYear}
          style={styles.slider}
        />

        <View style={styles.layerRow}>
          <View style={styles.layerDot} />
          <View style={styles.layerText}>
            <Text style={styles.layerTitle} numberOfLines={2}>
              {activeLayer === null ? copy.noCoverage : layerTitle(activeLayer, language)}
            </Text>
            {activeLayer === null ? null : (
              <Text style={styles.layerEra}>{eraLabel(activeLayer)}</Text>
            )}
          </View>
        </View>

        {statusMessage === null ? null : (
          <Text style={styles.statusMessage} accessibilityLiveRegion="polite">
            {statusMessage}
          </Text>
        )}

        <View style={styles.opacitySection}>
          <View style={styles.opacityHeading}>
            <Text style={styles.opacityLabel}>{copy.opacity}</Text>
            <Text style={styles.opacityValue}>{Math.round(opacity * 100)}%</Text>
          </View>
          <Slider
            accessibilityLabel={copy.opacity}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(opacity * 100) }}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={opacity}
            minimumTrackTintColor={COLORS.leaf}
            maximumTrackTintColor={COLORS.moss}
            thumbTintColor={COLORS.leafDark}
            onValueChange={setOpacity}
            style={styles.opacitySlider}
          />
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.coordinateText}>
            {copy.coordinates} {region.latitude.toFixed(4)}, {region.longitude.toFixed(4)}
          </Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={attributionText}
            onPress={() => void openAttribution()}
            style={styles.attributionButton}
          >
            <Text style={styles.attributionLink}>{attributionText} ↗</Text>
          </Pressable>
        </View>
        <Text style={styles.onlineText}>{copy.onlineOnly}</Text>

        {notice === null ? null : (
          <Text style={styles.notice} accessibilityLiveRegion="polite">
            {copy[notice]}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ChronomapDemo />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#edf4ef",
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  header: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  brandCard: {
    minWidth: 0,
    minHeight: 52,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.paper,
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.leaf,
  },
  brandMarkText: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
  },
  brandText: {
    minWidth: 0,
    flexShrink: 1,
    paddingRight: 2,
  },
  appName: {
    color: COLORS.ink,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  demoLabel: {
    marginTop: 1,
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  headerActions: {
    flexShrink: 0,
    alignItems: "flex-end",
    gap: 7,
  },
  compactButton: {
    minHeight: MIN_TOUCH_TARGET,
    maxWidth: 132,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 14,
    paddingHorizontal: 11,
    backgroundColor: COLORS.paper,
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  locateButton: {
    backgroundColor: "rgba(232, 247, 239, 0.98)",
  },
  compactButtonText: {
    flexShrink: 1,
    color: COLORS.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  locateIcon: {
    color: COLORS.leaf,
    fontSize: 18,
    fontWeight: "800",
  },
  timelineCard: {
    position: "absolute",
    borderRadius: 22,
    backgroundColor: COLORS.paper,
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  timelineContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  timelineHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  yearBlock: {
    flexShrink: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: 8,
  },
  eyebrow: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  yearValue: {
    color: COLORS.ink,
    fontSize: 27,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  presentButton: {
    flexShrink: 0,
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 13,
    paddingHorizontal: 12,
    backgroundColor: "#e8f4ed",
    borderWidth: 1,
    borderColor: COLORS.moss,
  },
  presentButtonText: {
    color: COLORS.leafDark,
    fontSize: 12,
    fontWeight: "800",
  },
  presentButtonYear: {
    color: COLORS.leafDark,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  slider: {
    width: "100%",
    height: MIN_TOUCH_TARGET,
    marginTop: 1,
  },
  layerRow: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "#f0f6f2",
  },
  layerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.leaf,
  },
  layerText: {
    flex: 1,
  },
  layerTitle: {
    color: COLORS.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  layerEra: {
    marginTop: 1,
    color: COLORS.muted,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },
  statusMessage: {
    marginTop: 7,
    color: COLORS.warning,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
  },
  opacitySection: {
    marginTop: 5,
  },
  opacityHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  opacityLabel: {
    flexShrink: 1,
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  opacitySlider: {
    width: "100%",
    height: MIN_TOUCH_TARGET,
  },
  opacityValue: {
    width: 38,
    color: COLORS.ink,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    textAlign: "right",
  },
  metaRow: {
    paddingTop: 3,
  },
  coordinateText: {
    color: COLORS.muted,
    fontSize: 10,
    fontVariant: ["tabular-nums"],
  },
  attributionButton: {
    minHeight: MIN_TOUCH_TARGET,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  attributionLink: {
    color: COLORS.leafDark,
    fontSize: 10,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  onlineText: {
    marginTop: 4,
    color: COLORS.muted,
    fontSize: 10,
  },
  notice: {
    marginTop: 7,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
    color: COLORS.ink,
    backgroundColor: "#e8f4ed",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
  },
});
