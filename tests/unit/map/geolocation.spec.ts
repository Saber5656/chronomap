import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  GEOLOCATION_OPTIONS,
  GeoError,
  isGeolocationAvailable,
  mapGeolocationErrorCode,
  requestFix,
} from "../../../src/map/geolocation";

type PositionCallbacks = {
  success: PositionCallback;
  options: PositionOptions;
};

function installGeolocation(getCurrentPosition: Geolocation["getCurrentPosition"]): void {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
}

describe("geolocation module", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
  });

  it("maps browser error codes to privacy-safe UI statuses", () => {
    expect(mapGeolocationErrorCode(1)).toBe("denied");
    expect(mapGeolocationErrorCode(2)).toBe("unavailable");
    expect(mapGeolocationErrorCode(3)).toBe("timeout");
    expect(mapGeolocationErrorCode(999)).toBe("unavailable");
  });

  it("requests one fix with the documented high-accuracy options", async () => {
    let callbacks: PositionCallbacks | undefined;
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>(
      (success, error, options) => {
        callbacks = {
          success,
          options: options ?? {},
        };
      },
    );
    installGeolocation(getCurrentPosition);

    const promise = requestFix();
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(callbacks?.options).toEqual(GEOLOCATION_OPTIONS);

    callbacks?.success({
      coords: {
        latitude: 35.681236,
        longitude: 139.767125,
        accuracy: 35,
      } as GeolocationCoordinates,
      timestamp: 1_724_000_000_000,
    } as GeolocationPosition);

    await expect(promise).resolves.toEqual({
      lat: 35.681236,
      lng: 139.767125,
      accuracyM: 35,
      at: 1_724_000_000_000,
    });
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "timeout"],
  ] as const)(
    "rejects code %s as %s without exposing the browser message",
    async (code, status) => {
      const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((_success, error) => {
        error?.({ code, message: "sensitive browser detail" } as GeolocationPositionError);
      });
      installGeolocation(getCurrentPosition);

      await expect(requestFix()).rejects.toMatchObject({
        name: "GeoError",
        status,
      });
      await expect(requestFix()).rejects.not.toHaveProperty("message", "sensitive browser detail");
    },
  );

  it("rejects unavailable when the API is absent or the context is insecure", async () => {
    expect(isGeolocationAvailable()).toBe(false);
    await expect(requestFix()).rejects.toMatchObject({ status: "unavailable" });

    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>();
    installGeolocation(getCurrentPosition);
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });

    expect(isGeolocationAvailable()).toBe(false);
    await expect(requestFix()).rejects.toMatchObject({ status: "unavailable" });
    expect(getCurrentPosition).not.toHaveBeenCalled();

    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: undefined,
    });

    expect(isGeolocationAvailable()).toBe(false);
    await expect(requestFix()).rejects.toMatchObject({ status: "unavailable" });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("rejects malformed browser positions as unavailable", async () => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((success) => {
      success({
        coords: {
          latitude: Number.NaN,
          longitude: 139.767125,
          accuracy: 35,
        } as GeolocationCoordinates,
        timestamp: 1,
      } as GeolocationPosition);
    });
    installGeolocation(getCurrentPosition);

    await expect(requestFix()).rejects.toBeInstanceOf(GeoError);
    await expect(requestFix()).rejects.toMatchObject({ status: "unavailable" });
  });

  it.each([undefined, { coords: undefined }])(
    "rejects malformed callback payload %j without leaving the promise pending",
    async (position) => {
      const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((success) => {
        success(position as unknown as GeolocationPosition);
      });
      installGeolocation(getCurrentPosition);

      await expect(requestFix()).rejects.toMatchObject({ status: "unavailable" });
    },
  );

  it("rejects an implausible accuracy value before it reaches consumers", async () => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((success) => {
      success({
        coords: {
          latitude: 35.681236,
          longitude: 139.767125,
          accuracy: 1_000_001,
        } as GeolocationCoordinates,
        timestamp: 1,
      } as GeolocationPosition);
    });
    installGeolocation(getCurrentPosition);

    await expect(requestFix()).rejects.toMatchObject({ status: "unavailable" });
  });
});
