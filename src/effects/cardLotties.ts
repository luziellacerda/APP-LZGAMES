import type { AnimationObject } from "lottie-react-native";

// User-selected public vector files, bundled with their reuse terms. No remote
// URLs, status mutations or player-side financial logic. See assets/README.md.
function credited(source: AnimationObject & { meta?: Record<string, unknown> }, credit: object): AnimationObject {
  return { ...source, meta: { ...source.meta, credit } } as AnimationObject;
}
export const cardLotties = {
  cashback: {
    source: credited(require("./assets/cashback-money.json"), require("./assets/cashback-money-license.json")),
    speed: 0.8, scale: 1.35, stillProgress: 0.5, fallback: "💵",
  },
  appCredit: {
    source: credited(require("./assets/app-credit-coin.json"), require("./assets/app-credit-coin-license.json")),
    speed: 0.7, scale: 1.3, stillProgress: 0, fallback: "🪙",
  },
  invite: {
    source: credited(require("./assets/invite-payment.json"), require("./assets/invite-payment-license.json")),
    speed: 0.8, scale: 1, stillProgress: 0.4, fallback: "✉",
  },
  entry: {
    source: credited(require("./assets/referral-entry-money.json"), require("./assets/referral-entry-money-license.json")),
    speed: 0.7, scale: 1.3, stillProgress: 0.5, fallback: "💵",
  },
  suite: {
    // Skip the original 20-frame empty lead-in and eight-frame empty tail.
    // The complete reveal/flight/exit remain within this host playback window.
    source: credited({ ...require("./assets/suite-rocket.json"), ip: 20, op: 136 }, require("./assets/suite-rocket-license.json")),
    speed: 0.8, scale: 1, stillProgress: 0.5, fallback: "🚀",
  },
};
export type CardLottieKind = keyof typeof cardLotties;
