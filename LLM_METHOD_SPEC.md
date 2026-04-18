# LLM Method Spec (Gemini Flash)

## Objective
Run a second feedback pipeline per squat rep using Gemini Flash, then compare it against the local math/rule pipeline.

## 1) Input Contract To LLM
Send one compact object per completed rep.

### Required Fields
```json
{
  "rep_id": "string",
  "timestamp_ms": 0,
  "camera_view": "front",
  "quality": {
    "avg_keypoint_confidence": 0.0,
    "low_confidence_frame_ratio": 0.0,
    "occlusion_flag": false
  },
  "timing": {
    "rep_duration_ms": 0,
    "descent_duration_ms": 0,
    "bottom_pause_ms": 0,
    "ascent_duration_ms": 0
  },
  "depth": {
    "bottom_hip_knee_diff": 0.0,
    "lowest_mean_knee_angle_deg": 0.0,
    "knee_angle_min_deg": 0.0,
    "knee_angle_max_deg": 0.0
  },
  "knee_tracking": {
    "min_ankle_width_px": 0.0,
    "max_left_inward_delta_ratio": 0.0,
    "max_right_inward_delta_ratio": 0.0
  },
  "torso": {
    "max_torso_lean_deg": 0.0,
    "lowest_hip_hinge_angle_deg": 0.0
  },
  "local_reference": {
    "label": "correct",
    "primary_issue": "none",
    "message": "Great rep. Depth and knee tracking looked solid."
  }
}
```

## 2) LLM Output Schema (Strict JSON)
Require the model to return only this object.

```json
{
  "label": "correct",
  "primary_issue": "none",
  "secondary_issue": "none",
  "confidence": 0.0,
  "coach_message": "string",
  "reason_codes": ["depth_ok", "knee_tracking_ok"],
  "risk_flags": [],
  "needs_human_review": false
}
```

### Enum Constraints
- label: `correct | incorrect`
- primary_issue: `none | depth_shallow | depth_too_deep | knee_valgus | torso_lean | hip_hinge_loss | low_quality_data`
- secondary_issue: same enum plus `none`
- confidence: float from 0.0 to 1.0
- reason_codes examples:
  - `depth_ok`
  - `depth_shallow`
  - `depth_too_deep`
  - `knee_tracking_ok`
  - `knee_valgus_detected`
  - `torso_lean_excessive`
  - `hip_hinge_unstable`
  - `low_confidence_data`

## 3) System Prompt Template
Use this as the system instruction for Gemini Flash.

```text
You are a strict squat-form evaluator.
Use only the numeric features provided in the input JSON.
Do not invent features, do not infer missing values.
Output exactly one JSON object matching the required schema.
No markdown, no prose, no extra keys.
Prioritize one primary_issue only.
If input quality is low, set primary_issue to low_quality_data and needs_human_review=true.
Coach message must be one short sentence.
```

## 4) User Prompt Template
Use this for each rep request.

```text
Evaluate this squat rep summary.
Rules:
1. Use only provided fields.
2. Return strict JSON only.
3. confidence must be 0.0-1.0.
4. Max one coaching sentence.
5. If data quality is poor, mark low_quality_data.

Rep summary:
<INSERT_REP_SUMMARY_JSON_HERE>
```

## 5) Suggested Decision Guardrails
Apply these before accepting LLM output:

1. JSON parse must succeed.
2. All required keys must exist.
3. Enum values must match allowed values.
4. confidence must be numeric and in range.
5. If validation fails, fallback to local output.

## 6) Hybrid Comparison Record (Per Rep)
Store one row per rep.

```json
{
  "rep_id": "string",
  "timestamp_ms": 0,
  "local": {
    "label": "correct",
    "primary_issue": "none",
    "message": "string"
  },
  "llm": {
    "label": "incorrect",
    "primary_issue": "knee_valgus",
    "confidence": 0.81,
    "message": "Push knees out slightly."
  },
  "agreement": false,
  "llm_latency_ms": 0,
  "parse_ok": true,
  "schema_ok": true,
  "manual_truth": "knee_valgus"
}
```

## 7) Quick Comparison Metrics
Track after test sessions:

1. Agreement rate between local and LLM.
2. Accuracy vs manual truth labels.
3. Per-issue precision:
   - depth_shallow
   - knee_valgus
   - torso_lean
   - hip_hinge_loss
4. Average LLM latency.
5. Parse/schema failure rate.

## 8) Recommended Rollout
1. Start in `compare` mode only (LLM does not override user-facing local result).
2. Run at least 50 labeled reps.
3. Tune prompt and thresholds.
4. Move to optional `LLM coach mode` after stability.

## 9) Privacy and Safety Notes
1. Send only summarized numeric features, not raw video frames.
2. Add an explicit user consent toggle for cloud inference.
3. Avoid medical claims in coach_message.
4. If confidence is low or quality is poor, use local feedback as primary.
