export type Language = "ja" | "en";

export const STRINGS = {
  ja: {
    appName: "chronomap",
    demoLabel: "Expo Go デモ",
    intro: "地図を動かして、年代を選んでください",
    language: "English",
    locate: "現在地",
    locating: "取得中…",
    year: "年代",
    present: "現在",
    opacity: "過去レイヤーの濃さ",
    noCoverage: "この縮尺・場所では利用できる過去画像がありません。拡大または移動してください。",
    registryError: "地図レイヤーを読み込めませんでした。",
    snapped: "選択年に最も近い利用可能な年代を表示しています。",
    locationGranted: "現在地へ移動しました。",
    locationDenied: "位置情報は許可されませんでした。東京のデモはそのまま利用できます。",
    locationUnavailable: "現在地を取得できませんでした。東京のデモはそのまま利用できます。",
    locationMarker: "取得した現在地",
    attributionFailed: "出典ページを開けませんでした。",
    attribution: "地理院タイル（国土地理院）",
    coordinates: "中心",
    onlineOnly: "地図画像の表示には通信が必要です",
  },
  en: {
    appName: "chronomap",
    demoLabel: "Expo Go demo",
    intro: "Move the map, then choose a year",
    language: "日本語",
    locate: "Locate",
    locating: "Locating…",
    year: "Year",
    present: "Today",
    opacity: "Historical layer opacity",
    noCoverage:
      "No historical imagery is available at this zoom and location. Zoom in or move the map.",
    registryError: "Map layers could not be loaded.",
    snapped: "Showing the closest available era to the selected year.",
    locationGranted: "Moved to your current location.",
    locationDenied: "Location was not allowed. The Tokyo demo remains available.",
    locationUnavailable: "Your location could not be read. The Tokyo demo remains available.",
    locationMarker: "Retrieved location",
    attributionFailed: "The attribution page could not be opened.",
    attribution: "GSI tiles (Geospatial Information Authority of Japan)",
    coordinates: "Center",
    onlineOnly: "An internet connection is required for map imagery",
  },
} as const;

export function initialLanguage(locale = Intl.DateTimeFormat().resolvedOptions().locale): Language {
  return locale.toLowerCase().startsWith("ja") ? "ja" : "en";
}
