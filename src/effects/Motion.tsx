import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  AppState,
  Dimensions,
  ScrollView,
  type ScrollViewProps,
  View,
} from "react-native";

type Entry = {
  node: React.RefObject<View | null>;
  visible: (value: boolean) => void;
};
const MotionContext = createContext({
  running: false,
  register:
    (_entry: Entry): (() => void) =>
    () => {},
  check: () => {},
});
export const SurfaceMotion = createContext(true);

/** One app-state subscription and a throttled visibility check for all decorations. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [reduce, setReduce] = useState(true);
  const entries = useRef(new Set<Entry>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const check = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      const screen = Dimensions.get("window");
      entries.current.forEach((entry) =>
        entry.node.current?.measureInWindow((x, y, w, h) => {
          if (entries.current.has(entry))
            entry.visible(
              w > 0 &&
                h > 0 &&
                x < screen.width &&
                x + w > 0 &&
                y < screen.height &&
                y + h > 0,
            );
        }),
      );
    }, 140);
  }, []);
  const register = useCallback(
    (entry: Entry) => {
      entries.current.add(entry);
      check();
      return () => {
        entries.current.delete(entry);
      };
    },
    [check],
  );
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduce(value);
      })
      .catch(() => {});
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduce,
    );
    const app = AppState.addEventListener("change", (value) =>
      setForeground(value === "active"),
    );
    const size = Dimensions.addEventListener("change", check);
    return () => {
      active = false;
      motion.remove();
      app.remove();
      size.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [check]);
  const running = foreground && !reduce;
  useEffect(() => {
    if (running) check();
  }, [running, check]);
  return (
    <MotionContext.Provider
      value={useMemo(
        () => ({ running, register, check }),
        [running, register, check],
      )}
    >
      {children}
    </MotionContext.Provider>
  );
}

export function useMotionAllowed() {
  return useContext(MotionContext).running;
}
export function useSurfaceVisibility(node: React.RefObject<View | null>) {
  const [visible, setVisible] = useState(false);
  const { register, check } = useContext(MotionContext);
  useEffect(() => register({ node, visible: setVisible }), [register, node]);
  return { visible, check };
}
export function MotionScrollView({
  onScroll,
  onContentSizeChange,
  ...props
}: ScrollViewProps) {
  const { check } = useContext(MotionContext);
  return (
    <ScrollView
      {...props}
      scrollEventThrottle={140}
      onScroll={(event) => {
        check();
        onScroll?.(event);
      }}
      onContentSizeChange={(w, h) => {
        check();
        onContentSizeChange?.(w, h);
      }}
    />
  );
}
