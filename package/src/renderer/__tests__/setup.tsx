import fs from "fs";
import path from "path";

import React from "react";
import type { ReactNode } from "react";
import ReactReconciler from "react-reconciler";

import { JsiSkApi } from "../../skia/web";
import { DependencyManager } from "../DependencyManager";
import { skHostConfig } from "../HostConfig";
import { Container } from "../nodes";
import type { DrawingContext } from "../DrawingContext";
import { CanvasProvider } from "../useCanvas";
import { ValueApi } from "../../values/web";
import { LoadSkiaWeb } from "../../web/LoadSkiaWeb";
import type { SkFont } from "../../skia";

export let Skia: ReturnType<typeof JsiSkApi>;
export let font: SkFont;

jest.mock("react-native", () => ({
  Platform: { OS: "web" },
  Image: {
    resolveAssetSource: jest.fn,
  },
}));

export const nodeRequire = (uri: string) => fs.readFileSync(uri);

beforeAll(async () => {
  await LoadSkiaWeb();
  Skia = JsiSkApi(global.CanvasKit);
  const data = Skia.Data.fromBytes(
    fs.readFileSync(
      path.resolve(__dirname, "../../skia/__tests__/assets/Roboto-Medium.ttf")
    )
  );
  const tf = Skia.Typeface.MakeFreeTypeFaceFromData(data)!;
  expect(tf).toBeTruthy();
  font = Skia.Font(tf, fontSize);
  expect(font).toBeTruthy();
});

const pixelDensity = 3;
export const fontSize = 32 * pixelDensity;
export const width = 256 * pixelDensity;
export const height = 256 * pixelDensity;
export const center = { x: width / 2, y: height / 2 };
const redraw = () => {};
const ref = { current: null };

const skiaReconciler = ReactReconciler(skHostConfig);

skiaReconciler.injectIntoDevTools({
  bundleType: 1,
  version: "0.0.1",
  rendererPackageName: "react-native-skia",
});

export const drawOnNode = (element: ReactNode) => {
  const { surface, draw } = mountCanvas(element);
  draw();
  return surface;
};

export const mountCanvas = (element: ReactNode) => {
  global.SkiaApi = Skia;
  expect(Skia).toBeDefined();
  const surface = Skia.Surface.Make(width, height)!;
  expect(surface).toBeDefined();
  const canvas = surface.getCanvas();
  expect(canvas).toBeDefined();
  expect(element).toBeDefined();
  const container = new Container(new DependencyManager(ref), redraw);
  skiaReconciler.createContainer(container, 0, false, null);
  const root = skiaReconciler.createContainer(container, 0, false, null);
  skiaReconciler.updateContainer(
    <CanvasProvider
      value={{ Skia, size: ValueApi.createValue({ width, height }) }}
    >
      {element}
    </CanvasProvider>,
    root,
    null,
    () => {}
  );
  const ctx: DrawingContext = {
    width,
    height,
    timestamp: 0,
    canvas,
    paint: Skia.Paint(),
    opacity: 1,
    ref,
    center: Skia.Point(width / 2, height / 2),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    fontMgr: null,
    Skia,
  };
  return { draw: () => container.draw(ctx), surface };
};
