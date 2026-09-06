import type { AnimationObject } from "lottie-react-native";
import type { AnimatedIconName } from "./animations";

type MenuLottie = {
  source: AnimationObject;
  scale: number;
  speed: number;
  stillProgress: number;
};

// Downloaded vector artwork and its full reuse terms ship in the app bundle.
// No URL is fetched by the player. Origin/adaptations: assets/README.md.
function credited(source: AnimationObject & { meta?: Record<string, unknown> }, credit: object): AnimationObject {
  return { ...source, meta: { ...source.meta, credit } } as AnimationObject;
}

export const menuLotties: Partial<Record<AnimatedIconName, MenuLottie>> = {
  rocket: {
    // Keep the craft visible: repeat the full flame cycle, omit entrance/exit.
    source: credited({ ...require("./assets/rocket-flight.json"), ip: 60, op: 180 }, require("./assets/rocket-license.json")),
    scale: 1.35,
    speed: 0.8,
    stillProgress: 0.5,
  },
  calendar: {
    source: credited(require("./assets/referral-calendar.json"), require("./assets/referral-calendar-license.json")),
    scale: 1,
    speed: 0.8,
    stillProgress: 0,
  },
  tools: {
    source: credited(require("./assets/wrench-service.json"), require("./assets/wrench-license.json")),
    scale: 1.25,
    speed: 0.8,
    stillProgress: 0,
  },
};
