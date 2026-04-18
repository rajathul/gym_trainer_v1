# agents.md — AI Squat Coach (MVP)

## 🎯 Goal
Build a real-time squat form coaching web app using pose estimation.  
The app should:
- Detect squats using webcam
- Count reps
- Classify each rep as correct/incorrect
- Provide minimal, non-annoying feedback

---

## 🧠 Core Principles

1. **Usability > Accuracy**
   - Avoid over-correcting users
   - Use tolerant thresholds

2. **Minimal Feedback**
   - NO constant feedback per frame
   - ONLY give feedback after a rep completes

3. **Fast & Local**
   - All inference runs in-browser
   - No backend required for MVP

---

## 🏗️ Tech Stack

- Frontend: HTML + JavaScript (or React if needed)
- Pose Model: MoveNet (TensorFlow.js)
- Rendering: Canvas overlay
- State Management: Simple JS state (no heavy frameworks needed)

---

## 📦 Dependencies

- @tensorflow/tfjs
- @tensorflow-models/pose-detection

---

## ⚙️ System Architecture

### Pipeline

1. Webcam Stream → Video Element
2. Pose Detection (MoveNet)
3. Keypoint Extraction
4. Feature Computation
5. Rep Detection State Machine
6. Form Evaluation
7. UI Feedback

---

## 🧍 Keypoints to Use

- Hip (left, right)
- Knee (left, right)
- Ankle (left, right)
- Shoulder (optional, for posture later)

---

## 📐 Feature Engineering

### Compute:

1. Knee Angle:
   - angle(hip, knee, ankle)

2. Hip Depth:
   - compare hip.y vs knee.y

3. Knee Alignment:
   - compare knee.x vs ankle.x

---

## 🔁 Rep Detection Logic

### States:
- `STANDING`
- `DESCENDING`
- `BOTTOM`
- `ASCENDING`

### Rules:

- Start in `STANDING`
- If hip moves down → `DESCENDING`
- If lowest point reached → `BOTTOM`
- If hip rises → `ASCENDING`
- If fully upright → count 1 rep → back to `STANDING`

---

## ✅ Form Evaluation (MVP)

### 1. Depth Check
Condition:
- hip.y < knee.y

If false:
- "Go lower"

---

### 2. Knee Alignment
Condition:
- knees should not move inward significantly

If inward:
- "Push your knees outward"

---

## 🧾 Rep Classification

After each rep:

IF:
- depth OK
- knees OK

→ increment `correct_count`

ELSE:
→ increment `incorrect_count`
→ store 1 main feedback message

---

## 🔊 Feedback Rules

### DO:
- Show 1 message per rep
- Use simple language

### DO NOT:
- Spam messages every frame
- Show multiple errors at once

---

## 🖥️ UI Requirements

### Display:
- Live video
- Pose skeleton overlay
- Rep counter
- Last feedback message

### Feedback Style:
- Green = correct
- Yellow = minor issue
- Red = incorrect

---

## ⚡ Performance Constraints

- Target: 20–30 FPS
- Use MoveNet Lightning model first
- Skip frames if needed

---

## 🧪 Testing Plan

Test with:
- Different lighting
- Different body types
- Different camera angles

Goal:
- Avoid false negatives

---

## 🚀 Milestones

### Phase 1 (Day 1–2)
- Webcam + pose detection working

### Phase 2 (Day 3–4)
- Rep detection

### Phase 3 (Day 5–6)
- Depth + knee checks

### Phase 4 (Day 7)
- UI + feedback polish

---

## 🔮 Future Improvements

- Add torso angle (posture)
- Add tempo control
- Add ML classifier for form
- Personalization (user calibration)

---

## ⚠️ Known Risks

- Pose jitter → smooth using moving average
- Camera angle sensitivity
- Occlusion (hands blocking knees)

---

## 🧠 Optional Enhancements

- Smoothing filter:
  - rolling average of last 5 frames

- Confidence threshold:
  - ignore keypoints with low confidence

---

## 🧑‍💻 Coding Guidelines

- Keep functions modular:
  - `detectPose()`
  - `computeAngles()`
  - `detectRepState()`
  - `evaluateForm()`

- Avoid overengineering
- Prioritize working demo over perfect design

---

## ✅ Definition of Done (MVP)

- User opens web app
- Camera starts
- User does squats
- App:
  - counts reps
  - shows correct/incorrect
  - gives 1 feedback per rep

---
