# Feedback To Angle Guide

All thresholds in this guide come from `calibration.config.js`.

## 1) Great rep. Depth and knee tracking looked solid.

You get this when all active checks pass:

- Depth is not shallow:
  - `bottomHipKneeDiff > depthDiffThreshold`
  - and `lowestMeanKneeAngle <= kneeTooShallowDeg`
- Knee tracking is stable:
  - either `minAnkleWidthPx < minAnkleWidthForKneeCheck` (skip strict knee check)
  - OR both inward ratios stay within buffer:
    - `maxLeftInwardDeltaRatio <= kneeTrackBufferRatio`
    - `maxRightInwardDeltaRatio <= kneeTrackBufferRatio`
- Optional side checks (when enabled) also pass:
  - `maxTorsoLeanDeg <= torsoNoGoDeg`
  - `lowestHipHingeAngle >= hipHingeMinDeg`

## 2) Go lower on your next rep.

You get this when depth fails:

- `bottomHipKneeDiff <= depthDiffThreshold`
- OR `lowestMeanKneeAngle > kneeTooShallowDeg`

Interpretation:

- Your hips did not go low enough relative to knees.
- Your knee bend angle was too open at the bottom.

## 3) Do not drop too deep. Keep control at the bottom.

You get this when knee angle is too closed at the bottom:

- `lowestMeanKneeAngle < kneeTooDeepDeg`

Interpretation:

- You are dropping too deep for current tolerance and likely losing control.

## 4) Push your knees slightly outward.

You get this when depth passes but knee alignment fails:

- `minAnkleWidthPx >= minAnkleWidthForKneeCheck`
- and both knees collapse inward from standing baseline beyond stance-relative buffer:
  - `maxLeftInwardDeltaRatio > kneeTrackBufferRatio`
  - `maxRightInwardDeltaRatio > kneeTrackBufferRatio`

## 5) Keep your chest up. Too much forward lean.

This check runs in side view by default (`cameraView: "side"`) or if forced on in front view.

- Trigger: `maxTorsoLeanDeg > torsoNoGoDeg`

## 6) Keep your pelvis neutral at the bottom.

This is a hip-hinge proxy for butt-wink risk.

- Trigger: `lowestHipHingeAngle < hipHingeMinDeg`

## 7) Depth is okay. Aim for a smoother 70-100 degree knee bend.

You get this when rep passes hard checks, but bottom knee angle is outside preferred quality range:

- `lowestMeanKneeAngle < kneeGoodMinDeg`
- OR `lowestMeanKneeAngle > kneeGoodMaxDeg`

## Notes

- `lowestMeanKneeAngle` = average of left and right knee angles at the deepest point.
- Lower knee angle means deeper squat.
- `maxLeftInwardDeltaRatio` / `maxRightInwardDeltaRatio` are inward movement ratios normalized by stance width.
- Torso and hip-hinge checks are more reliable in side view than front view.
