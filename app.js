const videoEl = document.getElementById("video");
const canvasEl = document.getElementById("overlay");
const ctx = canvasEl.getContext("2d");

const startButton = document.getElementById("startButton");
const pipelineStatus = document.getElementById("pipelineStatus");

const totalRepsEl = document.getElementById("totalReps");
const correctRepsEl = document.getElementById("correctReps");
const incorrectRepsEl = document.getElementById("incorrectReps");
const repStateEl = document.getElementById("repState");
const fpsEl = document.getElementById("fps");
const feedbackPanel = document.getElementById("feedbackPanel");
const feedbackText = document.getElementById("feedbackText");

const agreementBadgeEl = document.getElementById("agreementBadge");
const localLabelEl = document.getElementById("localLabel");
const localIssueEl = document.getElementById("localIssue");
const localMessageEl = document.getElementById("localMessage");
const llmStatusEl = document.getElementById("llmStatus");
const llmLabelEl = document.getElementById("llmLabel");
const llmIssueEl = document.getElementById("llmIssue");
const llmMessageEl = document.getElementById("llmMessage");

const DEFAULT_CONFIG = {
  motion_model: "movenet",
  cameraView: "front",
  minKeypointConfidence: 0.35,
  smoothWindow: 5,
  frameSkip: 2,
  baselineWindowFrames: 15,
  baselineStdDevThreshold: 4,
  startDescentOffset: 20,
  bottomOffset: 45,
  standTolerance: 16,
  downVelocity: 1.0,
  upVelocity: -1.0,
  minAnkleWidthForKneeCheck: 60,
  kneeTrackingEnabled: true,
  kneeTrackBufferRatio: 0.1,
  depthDiffThreshold: -35,
  kneeGoodMinDeg: 70,
  kneeGoodMaxDeg: 100,
  kneeTooShallowDeg: 110,
  kneeTooDeepDeg: 60,
  torsoNoGoDeg: 60,
  hipHingeMinDeg: 55,
  evaluateTorsoInFrontView: false,
  evaluateHipHingeInFrontView: false,
  llmCompareEnabled: false,
  llmProvider: "gemini",
  geminiModel: "gemini-2.0-flash",
  geminiApiKey: "",
  llmTimeoutMs: 20000,
  llmIncludeFrameSeries: false,
  llmMaxFrames: 24,
};

const APP_CONFIG = {
  ...DEFAULT_CONFIG,
  ...(window.SQUAT_CONFIG || {}),
  ...(window.SQUAT_CONFIG_SECRETS || {}),
};

const MOTION_MODEL = String(
  APP_CONFIG.motion_model || APP_CONFIG.motionModel || "movenet"
).toLowerCase();

const MIN_KEYPOINT_CONF = APP_CONFIG.minKeypointConfidence;
const SMOOTH_WINDOW = APP_CONFIG.smoothWindow;
const FRAME_SKIP = APP_CONFIG.frameSkip;
const BASELINE_WINDOW_FRAMES = APP_CONFIG.baselineWindowFrames;
const BASELINE_STDDEV_THRESHOLD = APP_CONFIG.baselineStdDevThreshold;

const TRACKED_BODY_KEYPOINTS = [
  "left_shoulder",
  "right_shoulder",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
];
const TRACKED_BODY_KEYPOINT_SET = new Set(TRACKED_BODY_KEYPOINTS);

const START_DESCENT_OFFSET = APP_CONFIG.startDescentOffset;
const BOTTOM_OFFSET = APP_CONFIG.bottomOffset;
const STAND_TOLERANCE = APP_CONFIG.standTolerance;
const DOWN_VELOCITY = APP_CONFIG.downVelocity;
const UP_VELOCITY = APP_CONFIG.upVelocity;

const CAMERA_VIEW = APP_CONFIG.cameraView;
const MIN_ANKLE_WIDTH_FOR_KNEE_CHECK = APP_CONFIG.minAnkleWidthForKneeCheck;
const DEPTH_DIFF_THRESHOLD = APP_CONFIG.depthDiffThreshold;
const KNEE_GOOD_MIN_DEG = APP_CONFIG.kneeGoodMinDeg;
const KNEE_GOOD_MAX_DEG = APP_CONFIG.kneeGoodMaxDeg;
const KNEE_TOO_SHALLOW_DEG = APP_CONFIG.kneeTooShallowDeg;
const KNEE_TOO_DEEP_DEG = APP_CONFIG.kneeTooDeepDeg;
const TORSO_NO_GO_DEG = APP_CONFIG.torsoNoGoDeg;
const HIP_HINGE_MIN_DEG = APP_CONFIG.hipHingeMinDeg;
const EVALUATE_TORSO =
  CAMERA_VIEW === "side" || APP_CONFIG.evaluateTorsoInFrontView;
const EVALUATE_HIP_HINGE =
  CAMERA_VIEW === "side" || APP_CONFIG.evaluateHipHingeInFrontView;

const LLM_COMPARE_ENABLED = APP_CONFIG.llmCompareEnabled;
const LLM_PROVIDER = APP_CONFIG.llmProvider;
const GEMINI_MODEL = APP_CONFIG.geminiModel;
const GEMINI_API_KEY = APP_CONFIG.geminiApiKey;
const LLM_TIMEOUT_MS = APP_CONFIG.llmTimeoutMs;
const LLM_INCLUDE_FRAME_SERIES = APP_CONFIG.llmIncludeFrameSeries;
const LLM_MAX_FRAMES = APP_CONFIG.llmMaxFrames;

const ISSUE_LABEL_MAP = {
  none: "none",
  depth_shallow: "depth shallow",
  depth_too_deep: "too deep",
  knee_valgus: "knees caving in",
  torso_lean: "torso lean",
  hip_hinge_loss: "hip hinge loss",
  quality_band: "quality band",
  low_quality_data: "low quality data",
  unknown: "unknown",
};

const state = {
  detector: null,
  stream: null,
  isRunning: false,
  repState: "STANDING",
  frameCount: 0,
  lastHipY: null,
  baselineHipY: null,
  baselineLocked: false,
  baselineSamples: [],
  smoothBuckets: {},
  totalReps: 0,
  correctReps: 0,
  incorrectReps: 0,
  repMetrics: makeRepMetrics(),
  fpsWindowStart: performance.now(),
  fpsWindowFrames: 0,
  repSequence: 0,
  activeRepFrames: [],
  activeRepStartedAtMs: null,
  llmInFlight: false,
};

const EDGES = [
  ["left_shoulder", "right_shoulder"],
  ["left_hip", "right_hip"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
];

startButton.addEventListener("click", () => {
  if (state.isRunning) {
    return;
  }
  void startApp();
});

bootstrapComparePanel();

async function startApp() {
  startButton.disabled = true;
  startButton.textContent = "Starting...";

  try {
    pipelineStatus.textContent = "Starting webcam";
    await setupCamera();

    pipelineStatus.textContent = `Loading ${MOTION_MODEL}`;
    await tf.setBackend("webgl");
    await tf.ready();

    state.detector = await createPoseDetector(MOTION_MODEL);

    resizeCanvasToVideo();
    window.addEventListener("resize", resizeCanvasToVideo);

    state.isRunning = true;
    startButton.textContent = "Camera Running";
    pipelineStatus.textContent = "Live coaching";

    requestAnimationFrame(loop);
  } catch (error) {
    console.error(error);
    pipelineStatus.textContent = "Unable to start. Check camera permission.";
    startButton.disabled = false;
    startButton.textContent = "Start Camera";
  }
}

async function createPoseDetector(modelName) {
  if (modelName === "mediapipe") {
    if (typeof window.Pose !== "function") {
      throw new Error("MediaPipe Pose runtime not loaded. Check pose.js script include.");
    }

    return poseDetection.createDetector(poseDetection.SupportedModels.BlazePose, {
      runtime: "mediapipe",
      modelType: "full",
      solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404",
    });
  }

  return poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
  });
}

async function setupCamera() {
  state.stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });

  videoEl.srcObject = state.stream;
  await videoEl.play();
}

function resizeCanvasToVideo() {
  canvasEl.width = videoEl.videoWidth || 1280;
  canvasEl.height = videoEl.videoHeight || 720;
}

async function loop() {
  if (!state.isRunning) {
    return;
  }

  state.frameCount += 1;
  const shouldProcess = state.frameCount % FRAME_SKIP === 0;

  if (shouldProcess) {
    await detectPose();
    updateFps();
  }

  requestAnimationFrame(loop);
}

async function detectPose() {
  if (!state.detector || videoEl.readyState < 2) {
    return;
  }

  const poses = await state.detector.estimatePoses(videoEl, {
    flipHorizontal: false,
  });

  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  if (!poses.length) {
    pipelineStatus.textContent = "No person detected";
    return;
  }

  const pose = poses[0];
  const rawKeypointMap = getRawKeypointMap(pose.keypoints);
  const keypointMap = getReliableKeypoints(pose.keypoints);

  drawSkeleton(keypointMap);

  const avgConfidence = getAverageConfidence(pose.keypoints);
  const lowConfidenceFrame = avgConfidence < MIN_KEYPOINT_CONF + 0.08;

  const metrics = computeAngles(keypointMap, rawKeypointMap);
  if (!metrics) {
    pipelineStatus.textContent = "Move fully into frame";
    return;
  }

  metrics.avgKeypointConfidence = avgConfidence;
  metrics.lowConfidenceFrame = lowConfidenceFrame;

  pipelineStatus.textContent = "Tracking form";
  detectRepState(metrics);
}

function getRawKeypointMap(keypoints) {
  const map = {};
  for (const kp of keypoints || []) {
    if (!kp.name) {
      continue;
    }
    map[kp.name] = kp;
  }
  return map;
}

function getReliableKeypoints(keypoints) {
  const map = {};

  for (const kp of keypoints) {
    const confidence = kp.score ?? 0;
    if (!kp.name || confidence < MIN_KEYPOINT_CONF) {
      continue;
    }
    map[kp.name] = kp;
  }

  return map;
}

function getAverageConfidence(keypoints) {
  if (!keypoints || !keypoints.length) {
    return 0;
  }

  const tracked = keypoints.filter(
    (kp) => kp.name && TRACKED_BODY_KEYPOINT_SET.has(kp.name)
  );
  if (!tracked.length) {
    return 0;
  }

  const sum = tracked.reduce((acc, kp) => acc + (kp.score ?? 0), 0);
  return sum / tracked.length;
}

function computeAngles(keypointMap, rawKeypointMap) {
  const leftShoulder = keypointMap.left_shoulder;
  const rightShoulder = keypointMap.right_shoulder;
  const leftHip = keypointMap.left_hip;
  const rightHip = keypointMap.right_hip;
  const leftKnee = keypointMap.left_knee;
  const rightKnee = keypointMap.right_knee;
  const leftAnkle = keypointMap.left_ankle;
  const rightAnkle = keypointMap.right_ankle;

  if (
    !leftHip ||
    !rightHip ||
    !leftKnee ||
    !rightKnee ||
    !leftAnkle ||
    !rightAnkle
  ) {
    return null;
  }

  const hip = {
    x: (leftHip.x + rightHip.x) / 2,
    y: smoothValue("hipY", (leftHip.y + rightHip.y) / 2),
  };

  const knee = {
    x: (leftKnee.x + rightKnee.x) / 2,
    y: smoothValue("kneeY", (leftKnee.y + rightKnee.y) / 2),
  };

  const leftKneeAngle = angle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = angle(rightHip, rightKnee, rightAnkle);

  let torsoLeanDeg = null;
  let meanHipHingeAngle = null;

  if (leftShoulder && rightShoulder) {
    const shoulderMid = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
    };

    const torsoDx = shoulderMid.x - hip.x;
    const torsoDy = shoulderMid.y - hip.y;
    torsoLeanDeg =
      (Math.atan2(Math.abs(torsoDx), Math.abs(torsoDy) + 1e-6) * 180) / Math.PI;

    const leftHipHinge = angle(leftShoulder, leftHip, leftKnee);
    const rightHipHinge = angle(rightShoulder, rightHip, rightKnee);
    meanHipHingeAngle = (leftHipHinge + rightHipHinge) / 2;
  }

  return {
    hip,
    knee,
    leftKneeAngle,
    rightKneeAngle,
    torsoLeanDeg,
    meanHipHingeAngle,
    ankleWidthPx: Math.abs(leftAnkle.x - rightAnkle.x),
    rawLlmKeypoints: extractLlmKeypoints(rawKeypointMap),
  };
}

function extractLlmKeypoints(rawKeypointMap) {
  const result = {};
  for (const name of TRACKED_BODY_KEYPOINTS) {
    const kp = rawKeypointMap?.[name];
    result[name] = kp
      ? {
          x: round3(kp.x),
          y: round3(kp.y),
          score: round3(kp.score ?? 0),
        }
      : null;
  }
  return result;
}

function detectRepState(metrics) {
  const nowMs = performance.now();
  const hipY = metrics.hip.y;
  const kneeY = metrics.knee.y;

  if (!state.baselineLocked) {
    state.baselineSamples.push(hipY);
    if (state.baselineSamples.length > BASELINE_WINDOW_FRAMES) {
      state.baselineSamples.shift();
    }
    if (state.baselineSamples.length >= BASELINE_WINDOW_FRAMES) {
      const samples = state.baselineSamples;
      const mean = samples.reduce((acc, v) => acc + v, 0) / samples.length;
      const variance =
        samples.reduce((acc, v) => acc + (v - mean) ** 2, 0) / samples.length;
      const stddev = Math.sqrt(variance);
      if (stddev <= BASELINE_STDDEV_THRESHOLD) {
        state.baselineHipY = mean;
        state.baselineLocked = true;
        state.lastHipY = hipY;
      }
    }
    if (!state.baselineLocked) {
      pipelineStatus.textContent = "Calibrating... stand still";
      return;
    }
  }

  const velocity = state.lastHipY === null ? 0 : hipY - state.lastHipY;
  state.lastHipY = hipY;

  if (state.repState === "STANDING") {
    state.baselineHipY = 0.95 * state.baselineHipY + 0.05 * hipY;
  }

  updateRepMetrics(metrics, nowMs);

  switch (state.repState) {
    case "STANDING": {
      if (
        hipY > state.baselineHipY + START_DESCENT_OFFSET &&
        velocity > DOWN_VELOCITY
      ) {
        state.repState = "DESCENDING";
        state.repMetrics = makeRepMetrics();
        state.activeRepFrames = [];
        state.activeRepStartedAtMs = nowMs;
        updateRepMetrics(metrics, nowMs);
        feedbackPanel.dataset.level = "neutral";
        feedbackText.textContent = "Rep in progress...";
      }
      break;
    }

    case "DESCENDING": {
      if (hipY > state.baselineHipY + BOTTOM_OFFSET && Math.abs(velocity) < 0.8) {
        state.repState = "BOTTOM";
      } else if (
        hipY > state.baselineHipY + BOTTOM_OFFSET * 0.7 &&
        velocity < UP_VELOCITY
      ) {
        state.repState = "ASCENDING";
      }
      break;
    }

    case "BOTTOM": {
      if (velocity < UP_VELOCITY) {
        state.repState = "ASCENDING";
      }
      break;
    }

    case "ASCENDING": {
      const uprightAgain = hipY <= state.baselineHipY + STAND_TOLERANCE;
      if (uprightAgain && velocity <= 1.2) {
        void completeRep();
        state.repState = "STANDING";
        state.repMetrics = makeRepMetrics();
        state.activeRepFrames = [];
        state.activeRepStartedAtMs = null;
      }
      break;
    }

    default:
      state.repState = "STANDING";
  }

  repStateEl.textContent = state.repState;

  const depthNow = hipY - kneeY;
  pipelineStatus.textContent =
    depthNow > DEPTH_DIFF_THRESHOLD
      ? "Tracking form"
      : "Tracking form (try deeper)";
}

function updateRepMetrics(metrics, timestampMs) {
  if (state.repState === "STANDING") {
    return;
  }

  const hipY = metrics.hip.y;
  const kneeY = metrics.knee.y;

  if (hipY > state.repMetrics.maxHipY) {
    state.repMetrics.maxHipY = hipY;
    state.repMetrics.bottomHipKneeDiff = hipY - kneeY;
  }

  state.repMetrics.minAnkleWidthPx = Math.min(
    state.repMetrics.minAnkleWidthPx,
    metrics.ankleWidthPx
  );

  const meanKneeAngle = (metrics.leftKneeAngle + metrics.rightKneeAngle) / 2;
  state.repMetrics.lowestMeanKneeAngle = Math.min(
    state.repMetrics.lowestMeanKneeAngle,
    meanKneeAngle
  );

  if (Number.isFinite(metrics.torsoLeanDeg)) {
    state.repMetrics.maxTorsoLeanDeg = Math.max(
      state.repMetrics.maxTorsoLeanDeg,
      metrics.torsoLeanDeg
    );
  }

  if (Number.isFinite(metrics.meanHipHingeAngle)) {
    state.repMetrics.lowestHipHingeAngle = Math.min(
      state.repMetrics.lowestHipHingeAngle,
      metrics.meanHipHingeAngle
    );
  }

  state.activeRepFrames.push({
    t: timestampMs,
    phase: state.repState,
    leftKneeAngle: metrics.leftKneeAngle,
    rightKneeAngle: metrics.rightKneeAngle,
    meanKneeAngle,
    hipKneeDiff: hipY - kneeY,
    torsoLeanDeg: metrics.torsoLeanDeg,
    hipHingeDeg: metrics.meanHipHingeAngle,
    ankleWidthPx: metrics.ankleWidthPx,
    avgKeypointConfidence: metrics.avgKeypointConfidence,
    lowConfidenceFrame: Boolean(metrics.lowConfidenceFrame),
    llmKeypoints: metrics.rawLlmKeypoints,
  });
}

function evaluateForm(metricsForRep) {
  const hasKneeAngle = Number.isFinite(metricsForRep.lowestMeanKneeAngle);
  const depthByHipKnee = metricsForRep.bottomHipKneeDiff > DEPTH_DIFF_THRESHOLD;
  const kneeTooShallow = hasKneeAngle && metricsForRep.lowestMeanKneeAngle > KNEE_TOO_SHALLOW_DEG;
  const kneeTooDeep = hasKneeAngle && metricsForRep.lowestMeanKneeAngle < KNEE_TOO_DEEP_DEG;
  const depthOK = depthByHipKnee && !kneeTooShallow;

  // Knee inward/outward cue is intentionally disabled for this workflow.
  const kneesOK = true;

  const torsoBad =
    EVALUATE_TORSO &&
    Number.isFinite(metricsForRep.maxTorsoLeanDeg) &&
    metricsForRep.maxTorsoLeanDeg > TORSO_NO_GO_DEG;

  const hipHingeBad =
    EVALUATE_HIP_HINGE &&
    Number.isFinite(metricsForRep.lowestHipHingeAngle) &&
    metricsForRep.lowestHipHingeAngle < HIP_HINGE_MIN_DEG;

  const kneeDepthOutOfGoodRange =
    hasKneeAngle &&
    (metricsForRep.lowestMeanKneeAngle < KNEE_GOOD_MIN_DEG ||
      metricsForRep.lowestMeanKneeAngle > KNEE_GOOD_MAX_DEG);

  if (!depthOK) {
    return {
      isCorrect: false,
      label: "incorrect",
      level: "bad",
      primaryIssue: "depth_shallow",
      message: "Go lower on your next rep.",
      confidence: 0.92,
      reasonCodes: ["depth_shallow"],
    };
  }

  if (kneeTooDeep) {
    return {
      isCorrect: false,
      label: "incorrect",
      level: "warn",
      primaryIssue: "depth_too_deep",
      message: "Do not drop too deep. Keep control at the bottom.",
      confidence: 0.76,
      reasonCodes: ["depth_too_deep"],
    };
  }

  if (torsoBad) {
    return {
      isCorrect: false,
      label: "incorrect",
      level: "warn",
      primaryIssue: "torso_lean",
      message: "Keep your chest up. Too much forward lean.",
      confidence: 0.77,
      reasonCodes: ["torso_lean_excessive"],
    };
  }

  if (hipHingeBad) {
    return {
      isCorrect: false,
      label: "incorrect",
      level: "warn",
      primaryIssue: "hip_hinge_loss",
      message: "Keep your pelvis neutral at the bottom.",
      confidence: 0.74,
      reasonCodes: ["hip_hinge_unstable"],
    };
  }

  if (kneeDepthOutOfGoodRange) {
    return {
      isCorrect: false,
      label: "incorrect",
      level: "warn",
      primaryIssue: "quality_band",
      message: "Depth is okay. Aim for a smoother 70-100 degree knee bend.",
      confidence: 0.68,
      reasonCodes: ["depth_band_advice"],
    };
  }

  return {
    isCorrect: true,
    label: "correct",
    level: "good",
    primaryIssue: "none",
    message: "Great rep. Depth and knee tracking looked solid.",
    confidence: 0.9,
    reasonCodes: ["depth_ok", "knee_tracking_ok"],
  };
}

async function completeRep() {
  const repId = `rep-${++state.repSequence}`;
  const localInput = buildLocalEvaluationInput();
  const localOutcome = evaluateForm(localInput);

  state.totalReps += 1;
  if (localOutcome.isCorrect) {
    state.correctReps += 1;
  } else {
    state.incorrectReps += 1;
  }

  totalRepsEl.textContent = String(state.totalReps);
  correctRepsEl.textContent = String(state.correctReps);
  incorrectRepsEl.textContent = String(state.incorrectReps);

  feedbackPanel.dataset.level = localOutcome.level;
  feedbackText.textContent = localOutcome.message;

  if (!LLM_COMPARE_ENABLED) {
    updateLocalComparison(localOutcome);
    setLlmStatus("Disabled");
    llmMessageEl.textContent = "Enable llmCompareEnabled in calibration config.";
    setAgreementBadge("neutral", "LLM disabled");
    return;
  }

  if (LLM_PROVIDER !== "gemini") {
    updateLocalComparison(localOutcome);
    setLlmStatus("Unsupported provider");
    llmMessageEl.textContent = "Only Gemini provider is wired in this MVP.";
    setAgreementBadge("neutral", "LLM provider unsupported");
    return;
  }

  if (!GEMINI_API_KEY) {
    updateLocalComparison(localOutcome);
    setLlmStatus("API key missing");
    llmMessageEl.textContent = "Add geminiApiKey in calibration config.";
    setAgreementBadge("neutral", "Missing API key");
    return;
  }

  if (state.llmInFlight) {
    pipelineStatus.textContent = `Rep ${state.totalReps}: LLM busy on previous rep, skipped`;
    return;
  }

  state.llmInFlight = true;
  updateLocalComparison(localOutcome);
  setLlmPending();

  const llmPayload = buildLlmRawPayload(repId);

  try {
    const started = performance.now();
    const llmResult = await requestGeminiFeedback(llmPayload);
    const latencyMs = Math.round(performance.now() - started);
    applyLlmComparison(localOutcome, llmResult, latencyMs);
  } catch (error) {
    console.error(error);
    setLlmStatus("Error");
    if (error && error.name === "AbortError") {
      llmMessageEl.textContent =
        "LLM timed out. Increase llmTimeoutMs or reduce payload size.";
      setAgreementBadge("neutral", "LLM timeout");
    } else {
      llmMessageEl.textContent = "LLM call failed. Using local result only.";
      setAgreementBadge("neutral", "LLM unavailable");
    }
  } finally {
    state.llmInFlight = false;
  }
}

function buildLocalEvaluationInput() {
  return {
    bottomHipKneeDiff: state.repMetrics.bottomHipKneeDiff,
    lowestMeanKneeAngle: state.repMetrics.lowestMeanKneeAngle,
    maxTorsoLeanDeg: state.repMetrics.maxTorsoLeanDeg,
    lowestHipHingeAngle: state.repMetrics.lowestHipHingeAngle,
    minAnkleWidthPx: state.repMetrics.minAnkleWidthPx,
  };
}

function buildLlmRawPayload(repId) {
  const frames = state.activeRepFrames;

  const repDurationMs = durationMs(frames);
  const descentDurationMs = phaseDurationMs(frames, "DESCENDING");
  const bottomPauseMs = phaseDurationMs(frames, "BOTTOM");
  const ascentDurationMs = phaseDurationMs(frames, "ASCENDING");

  const avgConfStats = stats(frames.map((f) => f.avgKeypointConfidence));
  const lowConfidenceCount = frames.filter((f) => f.lowConfidenceFrame).length;

  const lowConfidenceRatio = frames.length
    ? lowConfidenceCount / frames.length
    : 1;

  const occlusionFlag =
    lowConfidenceRatio > 0.35 ||
    state.repMetrics.minAnkleWidthPx < MIN_ANKLE_WIDTH_FOR_KNEE_CHECK;

  const payload = {
    rep_id: repId,
    timestamp_ms: Date.now(),
    camera_view: CAMERA_VIEW,
    input_type: "raw_keypoints_time_series",
    quality: {
      avg_keypoint_confidence: round3(avgConfStats.mean),
      low_confidence_frame_ratio: round3(lowConfidenceRatio),
      occlusion_flag: Boolean(occlusionFlag),
    },
    timing: {
      rep_duration_ms: Math.round(repDurationMs),
      descent_duration_ms: Math.round(descentDurationMs),
      bottom_pause_ms: Math.round(bottomPauseMs),
      ascent_duration_ms: Math.round(ascentDurationMs),
    },
    frames_count: frames.length,
  };

  if (LLM_INCLUDE_FRAME_SERIES) {
    const sampledFrames = sampleFrames(frames, Math.max(1, LLM_MAX_FRAMES));
    payload.frames = sampledFrames.map((f) => ({
      t: Math.round(f.t),
      phase: f.phase,
      keypoints: f.llmKeypoints,
      conf: round3(f.avgKeypointConfidence),
    }));
  } else {
    payload.frames = [
      firstWithPhase(frames, "DESCENDING"),
      firstWithPhase(frames, "BOTTOM"),
      firstWithPhase(frames, "ASCENDING"),
    ]
      .filter(Boolean)
      .map((f) => ({
        t: Math.round(f.t),
        phase: f.phase,
        keypoints: f.llmKeypoints,
        conf: round3(f.avgKeypointConfidence),
      }));
  }

  return payload;
}

async function requestGeminiFeedback(repSummary) {
  const prompt = buildGeminiPrompt(repSummary);

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL
  )}:generateContent`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), LLM_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status}`);
  }

  const data = await response.json();
  const rawText =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n") || "";

  const parsed = parseModelJson(rawText);
  return validateLlmOutput(parsed);
}

function buildGeminiPrompt(repSummary) {
  return [
    "You are a personal trainer giving advice on the form of a squat rep for a beginner.",
    "Use only the JSON provided below as your input",
    "Compute all biomechanics from raw keypoint coordinates inside frames[].keypoints.",
    "Do not use fixed thresholds from outside data and do not reference local model output.",
    "Focus on depth, knee valgus/varus behavior over time, torso lean, and low-quality data.",
    "Return exactly one JSON object with keys:",
    "label, primary_issue, secondary_issue, confidence, coach_message, reason_codes, risk_flags, needs_human_review.",
    "Allowed label: correct|incorrect.",
    "Allowed primary_issue/secondary_issue: none|depth_shallow|depth_too_deep|knee_valgus|torso_lean|hip_hinge_loss|low_quality_data.",
    "confidence must be a number between 0 and 1.",
    "coach_message must be one short sentence.",
    "No markdown.",
    "Rep summary JSON:",
    JSON.stringify(repSummary),
  ].join("\n");
}

function firstWithPhase(frames, phase) {
  for (const frame of frames) {
    if (frame.phase === phase) {
      return frame;
    }
  }
  return frames.length ? frames[0] : null;
}

function parseModelJson(text) {
  if (!text) {
    throw new Error("LLM response was empty");
  }

  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) {
      throw new Error("LLM response did not contain JSON");
    }
    return JSON.parse(trimmed.slice(first, last + 1));
  }
}

function validateLlmOutput(output) {
  const allowedLabels = new Set(["correct", "incorrect"]);
  const allowedIssues = new Set([
    "none",
    "depth_shallow",
    "depth_too_deep",
    "knee_valgus",
    "torso_lean",
    "hip_hinge_loss",
    "low_quality_data",
  ]);

  if (!output || typeof output !== "object") {
    throw new Error("LLM output must be an object");
  }

  if (!allowedLabels.has(output.label)) {
    throw new Error("Invalid llm label");
  }

  if (!allowedIssues.has(output.primary_issue)) {
    throw new Error("Invalid primary issue");
  }

  if (!allowedIssues.has(output.secondary_issue)) {
    throw new Error("Invalid secondary issue");
  }

  if (typeof output.confidence !== "number" || output.confidence < 0 || output.confidence > 1) {
    throw new Error("Invalid confidence value");
  }

  if (typeof output.coach_message !== "string") {
    throw new Error("Invalid coach message");
  }

  return {
    label: output.label,
    primaryIssue: output.primary_issue,
    secondaryIssue: output.secondary_issue,
    confidence: output.confidence,
    message: output.coach_message,
    reasonCodes: Array.isArray(output.reason_codes) ? output.reason_codes : [],
    riskFlags: Array.isArray(output.risk_flags) ? output.risk_flags : [],
    needsHumanReview: Boolean(output.needs_human_review),
  };
}

function bootstrapComparePanel() {
  if (!LLM_COMPARE_ENABLED) {
    setLlmStatus("Disabled");
    llmMessageEl.textContent = "Enable llmCompareEnabled in calibration config.";
  } else if (!GEMINI_API_KEY) {
    setLlmStatus("API key missing");
    llmMessageEl.textContent = "Add geminiApiKey in calibration config.";
  } else {
    setLlmStatus("Ready");
    llmMessageEl.textContent = "Waiting for rep...";
  }
}

function updateLocalComparison(localOutcome) {
  localLabelEl.textContent = localOutcome.label;
  localIssueEl.textContent = ISSUE_LABEL_MAP[localOutcome.primaryIssue] || localOutcome.primaryIssue;
  localMessageEl.textContent = localOutcome.message;
}

function setLlmPending() {
  setLlmStatus("Running...");
  llmLabelEl.textContent = "-";
  llmIssueEl.textContent = "-";
  llmMessageEl.textContent = "Evaluating this rep with Gemini...";
  setAgreementBadge("neutral", "Computing agreement");
}

function applyLlmComparison(localOutcome, llmResult, latencyMs) {
  setLlmStatus(`Done (${latencyMs}ms)`);
  llmLabelEl.textContent = llmResult.label;
  llmIssueEl.textContent = ISSUE_LABEL_MAP[llmResult.primaryIssue] || llmResult.primaryIssue;
  llmMessageEl.textContent = llmResult.message;

  const agreement =
    localOutcome.label === llmResult.label &&
    localOutcome.primaryIssue === llmResult.primaryIssue;

  if (agreement) {
    setAgreementBadge("good", "Models agree");
  } else {
    setAgreementBadge("bad", "Models disagree");
  }
}

function setAgreementBadge(kind, text) {
  agreementBadgeEl.classList.remove("good", "bad", "neutral");
  agreementBadgeEl.classList.add(kind);
  agreementBadgeEl.textContent = text;
}

function setLlmStatus(text) {
  llmStatusEl.textContent = text;
}

function updateFps() {
  state.fpsWindowFrames += 1;
  const now = performance.now();
  const elapsedMs = now - state.fpsWindowStart;

  if (elapsedMs >= 1000) {
    const fps = Math.round((state.fpsWindowFrames * 1000) / elapsedMs);
    fpsEl.textContent = String(fps);
    state.fpsWindowFrames = 0;
    state.fpsWindowStart = now;
  }
}

function drawSkeleton(keypointMap) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(76, 201, 240, 0.85)";
  ctx.fillStyle = "rgba(240, 246, 252, 0.95)";

  for (const [fromName, toName] of EDGES) {
    const from = keypointMap[fromName];
    const to = keypointMap[toName];
    if (!from || !to) {
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  for (const keypoint of Object.values(keypointMap)) {
    ctx.beginPath();
    ctx.arc(keypoint.x, keypoint.y, 3.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function smoothValue(bucketName, value) {
  if (!state.smoothBuckets[bucketName]) {
    state.smoothBuckets[bucketName] = [];
  }

  const bucket = state.smoothBuckets[bucketName];
  bucket.push(value);

  if (bucket.length > SMOOTH_WINDOW) {
    bucket.shift();
  }

  const sum = bucket.reduce((acc, item) => acc + item, 0);
  return sum / bucket.length;
}

function angle(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };

  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAb = Math.hypot(ab.x, ab.y);
  const magCb = Math.hypot(cb.x, cb.y);

  const cosine = dot / (magAb * magCb + 1e-9);
  const clamped = Math.max(-1, Math.min(1, cosine));
  return (Math.acos(clamped) * 180) / Math.PI;
}

function makeRepMetrics() {
  return {
    maxHipY: -Infinity,
    bottomHipKneeDiff: -Infinity,
    minAnkleWidthPx: Infinity,
    lowestMeanKneeAngle: Infinity,
    maxTorsoLeanDeg: -Infinity,
    lowestHipHingeAngle: Infinity,
  };
}

function stats(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) {
    return { min: 0, max: 0, mean: 0 };
  }

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const mean = clean.reduce((acc, value) => acc + value, 0) / clean.length;
  return { min, max, mean };
}

function phaseDurationMs(frames, phase) {
  if (!frames.length) {
    return 0;
  }

  let total = 0;
  for (let i = 1; i < frames.length; i += 1) {
    const prev = frames[i - 1];
    const curr = frames[i];
    if (curr.phase === phase) {
      total += Math.max(0, curr.t - prev.t);
    }
  }
  return total;
}

function durationMs(frames) {
  if (frames.length < 2) {
    return 0;
  }
  return Math.max(0, frames[frames.length - 1].t - frames[0].t);
}

function round3(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? round3(value) : null;
}

function sampleFrames(frames, limit) {
  if (frames.length <= limit) {
    return frames;
  }

  const result = [];
  const step = (frames.length - 1) / (limit - 1);
  for (let i = 0; i < limit; i += 1) {
    const idx = Math.round(i * step);
    result.push(frames[idx]);
  }
  return result;
}
