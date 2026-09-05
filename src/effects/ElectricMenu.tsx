import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useMotionAllowed } from "./Motion";
import { electricMenuHtml } from "./electricMenuScene";

export type MenuBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
const source = { html: electricMenuHtml };

/** One small transparent renderer for the whole nav, never a WebView per button. */
export function ElectricMenuEffects({
  bounds,
  selected,
  onReady,
  onFailure,
}: {
  bounds: MenuBounds[];
  selected: number;
  onReady: () => void;
  onFailure: () => void;
}) {
  const web = useRef<WebView>(null),
    ready = useRef(false);
  const motion = useMotionAllowed();
  const [failed, setFailed] = useState(false);
  const sync = () =>
    web.current?.injectJavaScript(
      `window.configureElectricMenu?.(${JSON.stringify({ bounds, selected, motion })});true;`,
    );
  useEffect(() => {
    if (ready.current) sync();
  }, [bounds, selected, motion]);
  const fail = () => {
    ready.current = false;
    setFailed(true);
    onFailure();
  };
  if (failed) return null;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <WebView
        ref={web}
        source={source}
        style={s.canvas}
        originWhitelist={["*"]}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        allowFileAccess={false}
        setSupportMultipleWindows={false}
        onError={fail}
        onContentProcessDidTerminate={fail}
        onRenderProcessGone={fail}
        onMessage={(event) => {
          if (event.nativeEvent.data === "electric-ready") {
            ready.current = true;
            sync();
            onReady();
          } else if (event.nativeEvent.data === "electric-error") fail();
        }}
      />
    </View>
  );
}
const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: "transparent" },
});
