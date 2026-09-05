import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useMotionAllowed } from "./Motion";
import { spaceflightHtml } from "./spaceflightScene";

const scene = { html: spaceflightHtml };

/** One camera keeps the ship, star field and exhaust in perspective. */
export function SpaceflightBackground() {
  const web = useRef<WebView>(null),
    motion = useMotionAllowed();
  const sync = () =>
    web.current?.injectJavaScript(`window.setMotionEnabled?.(${motion});true;`);
  useEffect(sync, [motion]);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={s.background}
    >
      <WebView
        ref={web}
        source={scene}
        style={s.space}
        originWhitelist={["*"]}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        onLoadEnd={sync}
        allowFileAccess={false}
        setSupportMultipleWindows={false}
      />
    </View>
  );
}
const s = StyleSheet.create({
  background: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  space: { flex: 1, backgroundColor: "#030a17" },
});
