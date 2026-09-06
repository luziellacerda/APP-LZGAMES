import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useMotionAllowed } from "./Motion";
import { VectorMotion } from "./Neon";
import { createCoinRainAnimation } from "./coinRainAnimation";

/** Decorative native Lottie, mounted only while the Sorteios tab is visible. */
export function CoinRainBackground() {
  const window = useWindowDimensions();
  const [size, setSize] = useState({ width: window.width, height: window.height });
  const [failed, setFailed] = useState(false);
  const motion = useMotionAllowed();
  const source = useMemo(() => createCoinRainAnimation(size.width, size.height), [size.width, size.height]);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, s.background]}
      onLayout={({ nativeEvent: { layout } }) => {
        const width = Math.round(layout.width), height = Math.round(layout.height);
        if (width > 0 && height > 0) setSize(current => current.width === width && current.height === height ? current : { width, height });
      }}
    >
      {failed ? (
        <View style={StyleSheet.absoluteFill}>
          {[0, 1, 2, 3, 4, 5].map(index => (
            <View key={index} style={[s.stillCoin, { left: `${8 + (index * 17) % 82}%`, top: `${6 + index * 15}%`, transform: [{ rotate: `${index * 13 - 24}deg` }] }]}>
              <Text style={s.stillEmblem}>✦</Text>
            </View>
          ))}
        </View>
      ) : (
        <VectorMotion source={source} running={motion} style={StyleSheet.absoluteFill} onFailure={() => setFailed(true)} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  background: { backgroundColor: "#060502", overflow: "hidden" },
  stillCoin: { position: "absolute", width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "#e0b052", backgroundColor: "#74501c", opacity: 0.35, alignItems: "center", justifyContent: "center" },
  stillEmblem: { color: "#f7d98e", fontSize: 20, lineHeight: 23 },
});
