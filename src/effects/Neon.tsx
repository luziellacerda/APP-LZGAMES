import React, {
  memo,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import LottieView, { type AnimationObject } from "lottie-react-native";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import {
  iconAnimations,
  laserAnimation,
  type AnimatedIconName,
} from "./animations";
import {
  SurfaceMotion,
  useMotionAllowed,
  useSurfaceVisibility,
} from "./Motion";
import { menuLotties } from "./menuLotties";

const fallback = {
  home: "⌂",
  tools: "🔧",
  calendar: "📅",
  rocket: "🚀",
  trophy: "🏆",
  user: "●",
};

export function VectorMotion({
  source,
  running,
  style,
  onFailure,
  speed = 1,
  stillProgress,
}: {
  source: AnimationObject;
  running: boolean;
  style: StyleProp<ViewStyle>;
  onFailure?: () => void;
  speed?: number;
  stillProgress?: number;
}) {
  const ref = useRef<LottieView>(null);
  useEffect(() => {
    if (running) ref.current?.resume();
    else ref.current?.pause();
  }, [running]);
  return (
    <LottieView
      ref={ref}
      source={source}
      autoPlay={running}
      loop
      speed={speed}
      progress={running ? undefined : stillProgress}
      useNativeLooping
      resizeMode="contain"
      style={style}
      onAnimationFailure={onFailure}
      onAnimationLoaded={() => {
        if (running) ref.current?.play();
        else ref.current?.pause();
      }}
    />
  );
}

export const AnimatedIcon = memo(function AnimatedIcon({
  name,
  size = 42,
  active = true,
}: {
  name: AnimatedIconName;
  size?: number;
  active?: boolean;
}) {
  const visible = useContext(SurfaceMotion),
    allowed = useMotionAllowed();
  const [failed, setFailed] = useState(false);
  const artwork = menuLotties[name];
  const canvas = size * (artwork?.scale ?? 1);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, overflow: "hidden" }}
    >
      {failed ? (
        <Text
          style={{
            fontSize: size * 0.6,
            color: "#a9dfcd",
            textAlign: "center",
          }}
        >
          {fallback[name]}
        </Text>
      ) : (
        <VectorMotion
          source={artwork?.source ?? iconAnimations[name]}
          running={allowed && visible && active}
          speed={artwork?.speed}
          stillProgress={artwork?.stillProgress}
          style={artwork ? {
            position: "absolute", width: canvas, height: canvas,
            left: (size - canvas) / 2, top: (size - canvas) / 2,
          } : StyleSheet.absoluteFill}
          onFailure={() => setFailed(true)}
        />
      )}
    </View>
  );
});

type NeonCardProps = ViewProps & {
  color?: string;
  radius?: number;
  electric?: boolean;
  animate?: boolean;
  decoration?: boolean;
  onPress?: () => void;
};

export function NeonCard({
  color = "#53f6a7",
  radius = 17,
  electric = false,
  animate = true,
  decoration = true,
  onPress,
  style,
  children,
  onLayout,
  ...props
}: NeonCardProps) {
  const root = useRef<View>(null);
  const { visible, check } = useSurfaceVisibility(root);
  const motion = useMotionAllowed();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [failed, setFailed] = useState(false);
  const source = useMemo(
    () =>
      size.w > 9 && size.h > 9
        ? laserAnimation(size.w, size.h, radius, color, electric)
        : null,
    [size.w, size.h, radius, color, electric],
  );
  const contents = (
    <SurfaceMotion.Provider value={visible}>
      {children}
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, overflow: "hidden" },
        ]}
      >
        {decoration && source && !failed ? (
          <VectorMotion
            source={source}
            running={motion && visible && animate}
            style={StyleSheet.absoluteFill}
            onFailure={() => setFailed(true)}
          />
        ) : null}
      </View>
    </SurfaceMotion.Provider>
  );
  const shared = {
    ...props,
    ref: root,
    collapsable: false,
    style: [
      s.card,
      {
        borderRadius: radius,
        borderColor: color + "66",
        // Native diffuse light and contact shadow; moving light stays in Lottie.
        boxShadow: decoration
          ? [
              {
                offsetX: 0,
                offsetY: 5,
                blurRadius: 10,
                color: "rgba(0,0,0,.55)",
              },
              {
                offsetX: 0,
                offsetY: 0,
                blurRadius: 12,
                spreadDistance: 0,
                color: color + "30",
              },
            ]
          : [],
      },
      style,
    ],
    onLayout: (event: Parameters<NonNullable<ViewProps["onLayout"]>>[0]) => {
      const w = Math.round(event.nativeEvent.layout.width),
        h = Math.round(event.nativeEvent.layout.height);
      setSize((current) =>
        current.w === w && current.h === h ? current : { w, h },
      );
      check();
      onLayout?.(event);
    },
  };
  return onPress ? (
    <Pressable
      {...shared}
      accessibilityRole={props.accessibilityRole ?? "button"}
      onPress={onPress}
    >
      {contents}
    </Pressable>
  ) : (
    <View {...shared}>{contents}</View>
  );
}

const s = StyleSheet.create({
  card: { position: "relative", borderWidth: 1 },
});
