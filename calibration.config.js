// Edit only these values to calibrate squat detection for your camera/user.
// All values are in pixels or degrees as noted.
window.SQUAT_CONFIG = {
  // Pose estimator runtime model: "mediapipe" or "movenet"
  motion_model: "mediapipe",

  // Camera mode: "front" or "side"
  // Side view enables torso lean and hip-hinge checks by default.
  cameraView: "front",

  // Camera selection: "auto", "user" (front), or "environment" (back)
  // In auto mode, mobile prefers back camera when preferBackCameraOnMobile is true.
  cameraFacingMode: "auto",
  preferBackCameraOnMobile: true,

  // Detection + performance
  minKeypointConfidence: 0.35,
  smoothWindow: 5,
  frameSkip: 2,

  // Rep state machine thresholds (pixels / frame delta)
  startDescentOffset: 20,
  bottomOffset: 45,
  standTolerance: 16,
  downVelocity: 1.0,
  upVelocity: -1.0,

  // Depth checks
  // Hip-vs-knee vertical difference at the bottom.
  // Higher (less negative) makes depth stricter.
  depthDiffThreshold: -35,

  // Knee-angle zones at the bottom of the rep.
  kneeGoodMinDeg: 70,
  kneeGoodMaxDeg: 100,
  kneeTooShallowDeg: 110,
  kneeTooDeepDeg: 60,

  // Knee alignment checks
  // Turn this off to completely disable inward/outward knee feedback.
  kneeTrackingEnabled: false,
  // Minimum ankle width before front-view knee alignment is trusted.
  minAnkleWidthForKneeCheck: 60,
  // Knee inward allowance as a fraction of stance width.
  // Higher = more relaxed (0.2 relaxed, 0.1 stricter).
  kneeTrackBufferRatio: 0.2,

  // Side-view checks (or force-enable for front view if desired)
  torsoNoGoDeg: 60,
  hipHingeMinDeg: 55,
  evaluateTorsoInFrontView: false,
  evaluateHipHingeInFrontView: false,

  // LLM compare mode
  llmCompareEnabled: true,
  llmProvider: "gemini",
  geminiModel: "gemini-3.1-flash-lite-preview",
  // geminiApiKey lives in calibration.local.js (git-ignored). See calibration.local.example.js.
  llmTimeoutMs: 20000,
  llmIncludeFrameSeries: false,
  llmMaxFrames: 24,
};
