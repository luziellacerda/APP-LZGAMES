import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMotionAllowed } from "./Motion";

/** Development-only visual receipt. Never included in the consumer screen. */
export function PreviewRevision() {
  const motion = useMotionAllowed();
  useEffect(() => {
    if (__DEV__) console.info(`[LZ PREVIEW VFX-15] motion=${motion}`);
  }, [motion]);
  if (!__DEV__) return null;
  return (
    <View pointerEvents="none" style={s.badge}>
      <Text style={s.text} testID="preview-revision">
        TESTE VFX-15 · {motion ? "EFEITOS ATIVOS" : "ANIMAÇÕES PAUSADAS"}
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  badge: {
    backgroundColor: "#18312c",
    paddingVertical: 4,
    alignItems: "center",
  },
  text: {
    color: "#c1ffe9",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
});
