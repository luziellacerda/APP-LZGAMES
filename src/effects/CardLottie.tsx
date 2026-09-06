import React, { memo, useContext, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SurfaceMotion, useMotionAllowed } from "./Motion";
import { VectorMotion } from "./Neon";
import { cardLotties, type CardLottieKind } from "./cardLotties";

export const CardLottie = memo(function CardLottie({ kind, width = 56, height = 42 }: { kind: CardLottieKind; width?: number; height?: number }) {
  const visible = useContext(SurfaceMotion), allowed = useMotionAllowed();
  const [failedKind, setFailedKind] = useState<CardLottieKind | null>(null);
  const artwork = cardLotties[kind], w = width * artwork.scale, h = height * artwork.scale;
  return <View testID={`card-lottie-${kind}`} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.slot, { width, height }]}>
    {failedKind === kind ? <Text style={[s.fallback, { fontSize: Math.min(width, height) * 0.55 }]}>{artwork.fallback}</Text> : <VectorMotion
      key={kind}
      source={artwork.source}
      running={visible && allowed}
      speed={artwork.speed}
      stillProgress={artwork.stillProgress}
      style={{ position: "absolute", width: w, height: h, left: (width - w) / 2, top: (height - h) / 2 }}
      onFailure={() => setFailedKind(kind)}
    />}
  </View>;
});

const s = StyleSheet.create({
  slot: { overflow: "hidden", flexShrink: 0, alignItems: "center", justifyContent: "center" },
  fallback: { color: "#f7db8c", textAlign: "center" },
});
