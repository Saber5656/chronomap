import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Native hosts are replaced; tests exercise the real App state and callbacks, not layout.
vi.mock("react-native", () => ({
  Linking: { openURL: vi.fn() },
  Platform: { OS: "ios" },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
  StyleSheet: { create: (styles) => styles, absoluteFill: {} },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
vi.mock("@react-native-community/slider", () => ({ default: "Slider" }));
vi.mock("expo-status-bar", () => ({ StatusBar: "StatusBar" }));
vi.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: vi.fn(async () => ({ granted: false })),
}));
vi.mock("react-native-maps", () => ({ default: "MapView", Marker: "Marker", UrlTile: "UrlTile" }));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: "SafeAreaProvider",
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
import App from "../../../apps/mobile/App";

describe("native time explorer interactions", () => {
  let view;
  beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    // Vite's test transform uses the classic JSX runtime; Expo uses its own transform.
    vi.stubGlobal("React", React);
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({ locale: "ja-JP" });
    await act(async () => {
      view = create(React.createElement(App));
    });
  });
  afterEach(async () => {
    await act(async () => {
      view?.unmount();
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps adjustment controls collapsed, preserves opacity when reopened, and retains credit", async () => {
    expect(view.root.findAllByType("Slider")).toHaveLength(1);
    expect(view.root.findByProps({ accessibilityRole: "link" })).toBeDefined();
    const disclosure = () =>
      view.root
        .findAllByType("Pressable")
        .find((node) => node.props.accessibilityState?.expanded !== undefined);
    await act(async () => disclosure().props.onPress());
    expect(view.root.findAllByType("Slider")).toHaveLength(2);
    await act(async () => view.root.findAllByType("Slider")[1].props.onValueChange(0.4));
    await act(async () => disclosure().props.onPress());
    await act(async () => disclosure().props.onPress());
    expect(view.root.findAllByType("Slider")[1].props.value).toBe(0.4);
  });

  it("selects years without a gesture and returns to the current year", async () => {
    const shortcut = view.root
      .findAllByType("Pressable")
      .find((node) => node.props.accessibilityLabel === "年代 1948");
    await act(async () => shortcut.props.onPress());
    expect(view.root.findAllByType("Slider")[0].props.value).toBe(1948);
    const today = view.root
      .findAllByType("Pressable")
      .find((node) => node.props.accessibilityLabel === `現在 ${new Date().getFullYear()}`);
    await act(async () => today.props.onPress());
    expect(view.root.findAllByType("Slider")[0].props.value).toBe(new Date().getFullYear());
  });

  it("keeps a path back to Tokyo when the viewed region has no historical coverage", async () => {
    await act(async () =>
      view.root.findByType("MapView").props.onRegionChangeComplete({
        latitude: 0,
        longitude: 0,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }),
    );
    const coverageMessages = view.root
      .findAllByType("Text")
      .filter(
        (node) =>
          typeof node.props.children === "string" &&
          node.props.children.includes("この縮尺・場所では"),
      );
    expect(coverageMessages).toHaveLength(1);
    const recovery = view.root
      .findAllByType("Pressable")
      .find((node) =>
        node
          .findAllByType("Text")
          .some((text) => String(text.props.children).includes("東京の地図へ戻る")),
      );
    expect(recovery).toBeDefined();
    await act(async () => recovery.props.onPress());
    expect(view.root.findAllByType("Slider")[0].props.value).toBe(1965);
    expect(view.root.findAllByType("UrlTile")).toHaveLength(2);
  });
});
