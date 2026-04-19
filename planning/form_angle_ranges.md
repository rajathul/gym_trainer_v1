# Squat Form Angle Ranges

Reference for the angle thresholds used by the local math model in `app.js` to
classify a rep as **correct** or **incorrect**. Thresholds are defined at
`app.js:96-102` and the verdict logic lives in `evaluateForm()` at
`app.js:564-658`.

## The thresholds

```
KNEE_GOOD_MIN_DEG    = 70    // ideal knee bend, lower bound
KNEE_GOOD_MAX_DEG    = 100   // ideal knee bend, upper bound
KNEE_TOO_SHALLOW_DEG = 110   // hard reject: didn't bend enough
KNEE_TOO_DEEP_DEG    = 60    // hard reject: bent too much
TORSO_NO_GO_DEG      = 60    // max forward torso lean from vertical
HIP_HINGE_MIN_DEG    = 55    // min hip hinge angle
DEPTH_DIFF_THRESHOLD = -35   // hip-Y minus knee-Y at bottom (pixels)
```

## What each measurement means

- **Knee angle** — interior angle at the knee (hip → knee → ankle).
  Standing straight ≈ 180°, deep squat ≈ small number. **Smaller = deeper.**
- **Torso lean** — degrees of forward tilt from vertical.
  0° = perfectly upright, 90° = horizontal.
- **Hip hinge** — interior angle at the hip (shoulder → hip → knee).
  180° = straight torso, smaller = more hinged forward.
- **Depth (hip-knee Y diff)** — pixels. Y axis is inverted in image coords,
  so positive means the hip is *below* the knee. `> -35` means the hip
  dropped to within 35 px of knee height (or lower).

## Verdict rules (evaluated in this order)

| # | Check | Triggers when | Verdict |
|---|---|---|---|
| 1 | Depth shallow | knee angle > 110° **or** hip stays > 35 px above knee | **incorrect** — "Go lower" |
| 2 | Too deep | knee angle < 60° | **incorrect** — "Don't drop too deep" |
| 3 | Torso lean *(side view only)* | torso lean > 60° from vertical | **incorrect** — "Chest up" |
| 4 | Hip hinge loss *(side view only)* | hip hinge angle < 55° | **incorrect** — "Pelvis neutral" |
| 5 | Quality band | knee angle < 70° **or** > 100° (but inside the hard limits) | **incorrect** — "Smoother 70–100° bend" |
| 6 | Otherwise | depth OK + knee in 70°–100° + no torso/hinge fault | **correct** ✓ |

## What a CORRECT rep requires

- **Knee angle at the bottom**: between **70° and 100°**
- **Hip-knee depth**: hip drops to within 35 px above knee (or below)
- *(side view only)* **Torso lean**: ≤ 60° forward
- *(side view only)* **Hip hinge**: ≥ 55°

## Active checks under the current config

`calibration.config.js:9` sets `cameraView: "front"`, and both
`evaluateTorsoInFrontView` and `evaluateHipHingeInFrontView` are `false`.
That means **only knee angle and depth are evaluated right now** — checks 3
and 4 are skipped. Only rules 1, 2, 5, and 6 in the table above are active.
