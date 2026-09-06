# Animation sources

## VFX-13 — exact user-selected card/calendar artwork

The six public animations below were retrieved and their license labels checked on **2026-09-05**. Each is offered under the [Lottie Simple License (FL 9.13.21)](https://lottiefiles.com/page/license). Full terms, authorship and source links are preserved in the corresponding `*-license.json` file and included as `source.meta.credit` in the application bundle. Modified playback/artwork remains subject to those terms. No animation is fetched at runtime; no external images, fonts or executable expressions remain in these playback files.

| Local file | Placement | Creator and original page |
| --- | --- | --- |
| `referral-entry-money.json` | “Indique e ganhe”, Home and Account | [Money — manju](https://lottiefiles.com/free-animation/money-JAEyxMYTN2) |
| `cashback-money.json` | Beside approved cashback value | [Money — Mahendra Bhunwal](https://lottiefiles.com/free-animation/money-9Rs7JUzu1D) |
| `app-credit-coin.json` | App-referral services credit | [Fake 3D vector coin — Christina Bublyk](https://lottiefiles.com/free-animation/fake-3d-vector-coin-0N5eblUHrK) |
| `invite-payment.json` | “Convide alguém” | [Payment Successful Animation — Uzair S.](https://lottiefiles.com/free-animation/payment-successful-animation-cUEV8IuLNE) |
| `referral-calendar.json` | Existing Agenda calendar slots | [El calendario — Kevin Diestra Montero](https://lottiefiles.com/free-animation/el-calendario-jxFJ2FUhZx) |
| `suite-rocket.json` | “Suite e licenças” card only | [rocket share — Pedro Lucas Gandara Santos](https://lottiefiles.com/free-animation/rocket-share-kQtY3BH2g7) |

`cardLotties.ts` controls the five card decorations; `menuLotties.ts` controls the calendar. All use the existing native `VectorMotion` player with surface visibility, background/reduced-motion pause, noninteractive bounds and static fallback. They do not display or change financial status. In particular, the payment animation is decorative, not evidence that a payment succeeded.

### `referral-entry-money.json`

- Original JSON: https://assets-v2.lottiefiles.com/a/6c3323c8-146a-11ef-9319-3b4522980f31/dMxzje5U9M.json
- License and metadata: [`referral-entry-money-license.json`](./referral-entry-money-license.json).
- Original artwork/keyframes retained. Green three-dimensional bundles of notes; distinct from the cashback illustration.
- 700 × 700, 30 fps, frames 0–60 (exclusive end 61), two vector layers; **44,806 bytes**.
- Host: speed **0.7**, centered scale **1.3**, slot **52 × 44 dp**, static progress **0.5**, avoiding the original blank first frame when motion is disabled.

### `cashback-money.json`

- Original JSON: https://assets-v2.lottiefiles.com/a/c35ecfca-117e-11ee-9bfc-5b34b16555ce/3YzWm6fJvz.json
- License and metadata: [`cashback-money-license.json`](./cashback-money-license.json).
- Original artwork/keyframes retained: green notes and stacks of gold coins.
- 500 × 500, 30 fps, frames 0–90 (exclusive end 91), 21 vector layers; **193,262 bytes**.
- Host: speed **0.8**, centered scale **1.35**, slot **64 × 42 dp**, static progress **0.5**. The original entrance has a blank first frame; the static pose is intentionally later.

### `app-credit-coin.json`

- Original JSON: https://assets-v2.lottiefiles.com/a/87edfc14-1169-11ee-a24d-2b3376e52a30/KNjdy3eXhD.json
- License and metadata: [`app-credit-coin-license.json`](./app-credit-coin-license.json).
- Original artwork/keyframes retained: a rotating gold coin. Older exported keyframe objects omit the optional `a: 1` marker; do not replace them with static values. Tests inspect the actual keyframes as well as newer-format animation markers.
- 600 × 600, 30 fps, frames 0–74 (exclusive end 75), one main precomposition layer and two local precompositions; **24,761 bytes**.
- Host: speed **0.7**, centered scale **1.3**, slot **52 × 42 dp**, static progress **0**.

### `invite-payment.json`

- Original JSON: https://assets-v2.lottiefiles.com/a/7e229164-7ff9-11ee-87a3-cf77872e519b/RE8uASyEli.json
- License and metadata: [`invite-payment-license.json`](./invite-payment-license.json).
- Local adaptation: removed only the full-composition pale-white rectangle named `Shape Layer 1`. Nine vector layers remain. The orange illustration behind the phones, card, plane/check and all their motion/colors are preserved; the area outside the illustration is transparent. This derivative remains under the same license.
- 2513 × 2000, approximately 29.97 fps, original frame range approximately 1–86; **119,346 bytes**.
- Host: speed **0.8**, scale **1**, slot **76 × 54 dp**, static progress **0.4**. Never use this decoration to announce a financial approval.

### `referral-calendar.json`

- Original JSON: https://assets-v2.lottiefiles.com/a/5e10bef6-116c-11ee-b345-2f458410e03a/883TbnB3N6.json
- License and metadata: [`referral-calendar-license.json`](./referral-calendar-license.json).
- A desk calendar with a person holding a pencil. Local adaptation for native playback: replaced the rotation expression on `Capa 15 contornos - Grupo 8` with the numeric rotation keyframes already exported on the referenced `Capa 15 contornos - Grupo 134`. Both layers share their timing/start/stretch, so the referenced rotation is preserved without evaluating an expression. No artwork or other keyframes were changed.
- 638 × 524, 30 fps, frames 0–180 (exclusive end 181), 25 vector layers; **190,974 bytes**.
- Host: complete animation at speed **0.8**, centered scale **1**, static progress **0**. Existing **54/32/28 dp** calendar slots are unchanged. The prior `calendar-booking.json` is retained below as historical source, but is no longer the active calendar in VFX-13.

### `suite-rocket.json`

- Original JSON: https://assets-v2.lottiefiles.com/a/32cf6cba-f014-11ee-8c74-939d84cf19ae/rQkdgFowh1.json
- License and metadata: [`suite-rocket-license.json`](./suite-rocket-license.json).
- Original artwork/keyframes retained: rocket, flame/smoke, stars and circular space scene. Its vector masks, nulls and solid backdrop inside the scene are intentional; do not remove them as though they were an unwanted full-screen white background.
- 1200 × 1200, 24 fps, frames 0–143 (exclusive end 144), 25 layers; **163,514 bytes**.
- Host: playback frames **20–135** (exclusive end 136), omitting the empty lead-in/tail; speed **0.8**, scale **1**, unchanged **54 × 54 dp** slot, static progress **0.5**. Stored original frame range remains unchanged.
- This is the user-requested **Suite e licenças card decoration**, not the separate `rocket` menu icon or the independent spacecraft background/engine simulation. Those remain untouched.

All six were rendered offline using SVG at multiple frames, then in the compact display sizes (including the 28 dp calendar). Unit tests cover exact asset mappings, local precomposition resolution, licenses, motion gates, fallback and fixed touch-free bounds. Android/Hermes export passed; native visual/performance testing on a physical device is still required. **These VFX-13 changes are later than APK 23 and have not yet been compiled into a new APK.**

## `trophy-spin.json`

- Title: **Trophy**.
- Creator: **Mahendra Bhunwal**.
- Source: https://lottiefiles.com/free-animation/trophy-yEGPe40FVr
- Original JSON: https://assets-v2.lottiefiles.com/a/745fc364-117b-11ee-b7ec-9f18a8a356e0/tRfofWoGlH.json
- License: **Lottie Simple License (FL 9.13.21)**, https://lottiefiles.com/page/license
- Retrieved and license checked: 2026-09-05.
- The source page explicitly labels this animation free under the Lottie Simple License. That license allows commercial use and modification; the animation and derivatives remain subject to the same license.
- Full license terms and creator/source metadata are available in [`trophy-license.json`](./trophy-license.json). Include that object as `source.meta.credit` when deriving the playback source so the terms accompany the animation in the application bundle.
- Original animation data preserved; local JSON serialization adds a trailing newline. No images, fonts, network references, or external asset files are required for playback.
- Composition: 500 × 500, 30 fps, frames 0–71 (2.367 seconds), 19 main layers and 24 nested vector layers across three precompositions. Local file size: 114,798 bytes.
- Motion verified in the SVG renderer: the gold cup, handles, and star change perspective during the turn (approximately frames 10–50), with an entrance and a short final hold. This is drawn rotational motion, rather than only animated sparkles.
- The original composition includes decorative rays and generous transparent margins. A compact UI should account for those margins when choosing the player size.
- For a continuously visible icon, the host plays frames 24–50 (exclusive end 51) at speed 0.45 (2 seconds per turn): the cup turns and returns to a frontal pose while avoiding the original off-center entrance. The cup's bounds over that interval are approximately x=122–383 and y=120–378 in the 500 × 500 composition; a centered 1.5× player inside a clipped square keeps the cup visible. VFX-12 reduces the artwork by approximately 12% from the previous 1.7× player without changing the UI slots. This playback window and speed are host adaptations, not changes to the original JSON file. The derived playback source remains under the same Lottie Simple License.

## `calendar-booking.json`

Historical calendar used before VFX-13. Retained for provenance/rollback, not referenced by the current calendar mapping. The playback notes below describe that former mapping.

- Title: **Book an appointment**.
- Creator: **Nick Carvin**.
- Source: https://lottiefiles.com/free-animation/book-an-appointment-qr6wNSM2kB
- Original JSON: https://assets-v2.lottiefiles.com/a/a4f7c8a4-1168-11ee-8ef1-83688d80a56d/7li5zJFvYy.json
- License: **Lottie Simple License (FL 9.13.21)**, https://lottiefiles.com/page/license
- Retrieved and license checked: 2026-09-05. The public source page labels this animation free under that license.
- Full creator/source metadata and license terms: [`calendar-license.json`](./calendar-license.json). The host includes these terms as `source.meta.credit` in the application bundle.
- Local adaptation: removed only the full-composition white solid layer named `White Solid 2` (`ty: 1`), making the background transparent. Vector artwork, colors, animation timing and keyframes remain unchanged. This derivative remains under the same license.
- Composition: 200 × 200, approximately 29.97 fps, `ip: 0`, `op: 114.000004643315`, approximately 3.804 seconds; eight vector layers. Local file size: **23,496 bytes**.
- The blue calendar transitions to a clock and then a confirmation check. No raster images, fonts, external assets, expressions or additional effects are required.
- Playback in `menuLotties.ts`: complete animation, speed **0.8** (approximately 4.755 seconds per loop), scale **1**, static progress **0** for a recognizable calendar when motion is disabled. The measured path bounds across every frame are approximately x=10–190 and y=13–193; extra enlargement could clip the clock/check transition or strokes.
- SVG preview checked offline on dark backgrounds at 54 px and 28 px. This verifies vector rendering, not native Android behavior; physical-device validation remains necessary.

## `wrench-service.json`

- Title: **Wrench**.
- Creator: **manju**.
- Source: https://lottiefiles.com/free-animation/wrench-6MVaBTVjrH
- Original JSON: https://assets-v2.lottiefiles.com/a/b57010fe-29a1-11ef-ad92-1b204986738d/qyVEMAp2pB.json
- License: **Lottie Simple License (FL 9.13.21)**, https://lottiefiles.com/page/license
- Retrieved and license checked: 2026-09-05. The public source page labels this animation free under that license.
- Full creator/source metadata and license terms: [`wrench-license.json`](./wrench-license.json). The host includes these terms as `source.meta.credit` in the application bundle.
- Original vector artwork, colors, timing and motion preserved; only local JSON serialization and a trailing newline differ. The open-ended repair wrench appears at the center of a lilac gear badge, not as a password key. The composition is transparent outside its circular badge.
- Composition: 800 × 800, 30 fps, frames 0–135, 4.5 seconds; eleven vector layers. Local file size: **21,029 bytes**. No raster images, fonts, external assets, expressions or additional effects are required.
- Playback in `menuLotties.ts`: complete animation, speed **0.8** (5.625 seconds per loop), centered scale **1.25**, static progress **0**. The `tools` icon name selects this asset. Its measured path bounds across all frames are approximately x/y=104–696; a larger 1.55× player would clip outer decorative dots, so retain the smaller scale.
- SVG preview checked offline at 54 px and 28 px on a dark moss surface. Physical-device validation remains necessary.

## `rocket-flight.json`

- Title: **Fire Rocket**.
- Creator: **Zainab Khalil**.
- Source: https://lottiefiles.com/free-animation/fire-rocket-KsyWftUB37
- Original JSON: https://assets-v2.lottiefiles.com/a/c901c19a-117d-11ee-9ed0-6ffa56532bf7/LFl0o6Kl4R.json
- License: **Lottie Simple License (FL 9.13.21)**, https://lottiefiles.com/page/license
- Retrieved and license checked: 2026-09-05. The public source page labels this animation free under that license.
- Full creator/source metadata and license terms: [`rocket-license.json`](./rocket-license.json). The host includes these terms as `source.meta.credit` in the application bundle.
- Local adaptation: removed the redundant anchor-point expression at `layers[8].ks.a.x`, retaining its exported numeric anchor point `[540.5, 534.5, 0]`. Original vector artwork, colors and keyframes are retained. This derivative remains under the same license.
- Composition: 1080 × 1080, 60 fps, frames 0–240, four seconds; eleven vector layers. Local file size: **98,727 bytes**. No raster images, fonts, external assets, expressions or additional effects are required for local playback.
- The host uses frames **60–179** (exclusive end 180), centered scale **1.35**, speed **0.8** (2.5 seconds per loop), and static progress **0.5**. This playback window repeats the flame cycle with the rocket already visible, omitting the original entrance/exit; it does not modify the stored animation's original frame range.
- This replaces the `rocket` menu icon only. It does not replace the independent spaceflight background or its engine effects. Native Android appearance should be checked on a physical device.
