import React, { memo, useContext, useEffect, useRef, useState } from "react";
import LottieView from "lottie-react-native";
import { StyleSheet, View } from "react-native";
import { AnimatedIcon } from "./Neon";
import { SurfaceMotion, useMotionAllowed } from "./Motion";

// Mahendra Bhunwal / LottieFiles. Original asset and license: assets/README.md.
const originalTrophy = require("./assets/trophy-spin.json");
const credit = require("./assets/trophy-license.json");
// Repeat the drawn perspective turn, not the off-canvas entrance. The original
// downloaded file remains intact, and both ends of this segment face forward.
const trophy = { ...originalTrophy, ip: 24, op: 51, meta: { ...originalTrophy.meta, credit } };

export const TrophyLottie = memo(function TrophyLottie({ size = 86 }: { size?: number }) {
  const ref = useRef<LottieView>(null);
  const visible = useContext(SurfaceMotion);
  const allowed = useMotionAllowed();
  const running = visible && allowed;
  const [failed, setFailed] = useState(false);
  // The original composition has generous transparent margins. Enlarge the
  // artwork inside its slot without making the card larger or blocking taps.
  const canvas = size * 1.5;

  useEffect(() => {
    if (running) ref.current?.resume();
    else ref.current?.pause();
  }, [running]);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[s.slot, { width: size, height: size }]}
    >
      {failed ? <AnimatedIcon name="trophy" size={size} /> : (
        <LottieView
          ref={ref}
          source={trophy}
          autoPlay={running}
          loop
          speed={0.45}
          useNativeLooping
          resizeMode="contain"
          // Show a complete trophy when accessibility requests no animation.
          progress={running ? undefined : 0}
          style={{ position: "absolute", width: canvas, height: canvas, left: (size - canvas) / 2, top: (size - canvas) / 2 }}
          onAnimationLoaded={() => {
            if (running) ref.current?.play();
            else ref.current?.pause();
          }}
          onAnimationFailure={() => setFailed(true)}
        />
      )}
    </View>
  );
});

const s = StyleSheet.create({ slot: { overflow: "hidden", alignItems: "center", justifyContent: "center" } });
