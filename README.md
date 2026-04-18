# Squat Coach MVP

Real-time squat form coaching web app using MoveNet in the browser.

## Features

- Webcam squat tracking with MoveNet Lightning
- Rep counting with a state machine (`STANDING`, `DESCENDING`, `BOTTOM`, `ASCENDING`)
- Per-rep classification:
  - Correct rep count
  - Needs-work rep count
- Single, minimal feedback message after each completed rep
- Live pose skeleton overlay

## Run Locally

Use a local server because camera access generally requires an origin like `http://localhost`.

```bash
cd /home/athul/my_workspace/antler_hackathon_2/gym_trainer_v1
python3 -m http.server 8080
```

Open:

- http://localhost:8080

Then click **Start Camera** and begin squats.

## Notes

- The app runs fully in the browser (no backend).
- MoveNet Lightning is used for speed.
- A small smoothing window is applied to reduce pose jitter.
- Frame skipping is used to keep responsive performance on typical laptops.

## Calibration (Edit One File)

You can tune squat sensitivity without touching app logic.

1. Open `calibration.config.js`
2. Change threshold values (depth, knee range, knee tracking, torso lean, etc.)
3. Save and hard refresh browser (`Ctrl+Shift+R`)

Main values to tune:

- `depthDiffThreshold`: higher (less negative) = stricter depth
- `kneeTooShallowDeg`: lower = stricter depth requirement
- `kneeTooDeepDeg`: higher = stricter bottom-depth safety
- `kneeTrackBufferRatio`: lower = stricter knee alignment

View mode:

- `cameraView: "front"` for front-camera knee tracking
- `cameraView: "side"` to enable torso lean + hip-hinge checks

## Local vs LLM Compare Mode

To run both approaches side-by-side:

1. Open `calibration.config.js`
2. Set `llmCompareEnabled: true`
3. Add your key in `geminiApiKey`
4. Keep `geminiModel` as `gemini-2.0-flash` (or change as needed)
5. Hard refresh browser (`Ctrl+Shift+R`)

You will see a comparison panel with:

- Local Math Model result (instant)
- LLM Model result (arrives after API call)
- Agreement badge (`Models agree` / `Models disagree`)

How isolation works in this mode:

- Local math module uses only local aggregated rep metrics.
- Gemini module receives a separate raw-keypoint payload (`frames[].keypoints`) and computes its own reasoning.
- Local output is not sent to Gemini and does not affect Gemini scoring.

Raw payload controls:

- `llmIncludeFrameSeries: true` sends sampled frame series up to `llmMaxFrames`.
- `llmIncludeFrameSeries: false` sends compact raw keyframes from descent, bottom, and ascent.

Security note:

- This MVP sends API calls directly from browser for quick testing.
- Do not use production secrets this way; move key handling to a backend before production.
