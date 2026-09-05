import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useMotionAllowed } from "./Motion";
import { trophyRainHtml } from "./trophyRainScene";

const source = { html: trophyRainHtml };

/** Only mounted on the Sorteios tab. All other Matrix screens stay unchanged. */
export function TrophyRainBackground() {
  const web = useRef<WebView>(null);
  const motion = useMotionAllowed();
  const sync = () =>
    web.current?.injectJavaScript(`window.setMotionEnabled?.(${motion});true;`);
  useEffect(sync, [motion]);
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
        style={s.web}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        onLoadEnd={sync}
        allowFileAccess={false}
        setSupportMultipleWindows={false}
        overScrollMode="never"
      />
    </View>
  );
}

const s = StyleSheet.create({
  web: { flex: 1, backgroundColor: "#060502" },
});
