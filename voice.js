// Voice coaching module: SpeechSynthesis TTS + Web Speech API STT.
// Loaded as type="module". Exposes window.voiceCoach for app.js to call.

const ENCOURAGING = [
  'Drive through your heels!',
  'Core tight, keep it up!',
  'Looking powerful!',
  'Perfect depth — keep that rhythm!',
  "You're absolutely crushing it!",
  'Chest up, stay strong!',
  'Power through — nearly there!',
  'Brilliant squat, keep the tempo!',
];

class VoiceCoach {
  #recognition = null;
  #voice = null;
  #queue = [];
  #speaking = false;
  #sttPaused = false;
  #phase = 'IDLE'; // 'IDLE' | 'FORM_CHECK' | 'SET_5'
  #setReps = 0;

  get phase()   { return this.#phase; }
  get setReps() { return this.#setReps; }

  // ── TTS ──────────────────────────────────────────────────────────────────

  initTTS() {
    const pickVoice = () => {
      const voices = speechSynthesis.getVoices();
      // Prefer Google online voices; fall back to any English voice.
      this.#voice =
        voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) ||
        voices.find(v => v.lang === 'en-GB' && v.name.includes('Google')) ||
        voices.find(v => v.lang.startsWith('en') && !v.localService) ||
        voices.find(v => v.lang.startsWith('en')) ||
        null;
    };
    pickVoice();
    speechSynthesis.addEventListener('voiceschanged', pickVoice);
  }

  speak(text) {
    this.#queue.push(text);
    if (!this.#speaking) this.#drainQueue();
  }

  async #drainQueue() {
    this.#speaking = true;
    while (this.#queue.length > 0) {
      const text = this.#queue.shift();
      this.#pauseSTT();
      await this.#sayLine(text);
      this.#resumeSTT();
    }
    this.#speaking = false;
  }

  #sayLine(text) {
    return new Promise(resolve => {
      const utt = new SpeechSynthesisUtterance(text);
      if (this.#voice) utt.voice = this.#voice;
      utt.rate   = 1.05;
      utt.pitch  = 1.0;
      utt.volume = 1.0;
      utt.onend   = resolve;
      utt.onerror = resolve; // don't block queue on error
      speechSynthesis.speak(utt);
    });
  }

  // ── STT ──────────────────────────────────────────────────────────────────

  initSTT() {
    const SR = window['SpeechRecognition'] || window['webkitSpeechRecognition'];
    if (!SR) return false;

    this.#recognition = new SR();
    this.#recognition.continuous = true;
    this.#recognition.interimResults = false;
    this.#recognition.lang = 'en-US';

    this.#recognition.onresult = e => {
      const last = e.results[e.results.length - 1];
      if (!last.isFinal) return;
      const heard = last[0].transcript.toLowerCase().trim();
      if (heard.includes('start') && this.#phase === 'IDLE') {
        this.#startFormCheck();
      }
    };

    // Auto-restart unless we deliberately paused it for TTS.
    this.#recognition.onend = () => {
      if (!this.#sttPaused) {
        try { this.#recognition.start(); } catch {}
      }
    };

    this.#recognition.start();
    return true;
  }

  #pauseSTT() {
    this.#sttPaused = true;
    try { this.#recognition?.stop(); } catch {}
  }

  #resumeSTT() {
    this.#sttPaused = false;
    try { this.#recognition?.start(); } catch {}
  }

  // ── Session state machine ─────────────────────────────────────────────────

  #startFormCheck() {
    this.#phase = 'FORM_CHECK';
    renderVoiceStatus();
    this.speak("Let's check your form. Do one squat rep.");
  }

  onRepComplete(outcome) {
    if (this.#phase === 'IDLE') return;

    if (this.#phase === 'FORM_CHECK') {
      if (outcome.isCorrect) {
        this.#phase = 'SET_5';
        this.#setReps = 0;
        renderVoiceStatus();
        this.speak("Great form! Now let's do a set of 5 reps. Go!");
      } else {
        this.speak(outcome.message + ' Try again.');
      }
      return;
    }

    if (this.#phase === 'SET_5') {
      if (outcome.isCorrect) {
        this.#setReps += 1;
        renderVoiceStatus();
        if (this.#setReps >= 5) {
          this.#phase = 'IDLE';
          this.#setReps = 0;
          renderVoiceStatus();
          this.speak('Five reps! Incredible work. You absolutely crushed that set!');
        } else {
          const left = 5 - this.#setReps;
          const phrase = Math.random() < 0.5
            ? ENCOURAGING[Math.floor(Math.random() * ENCOURAGING.length)]
            : null;
          const msg = phrase
            ? `${this.#setReps} down! ${phrase} ${left} more to go!`
            : `${this.#setReps} down, ${left} to go. Keep it up!`;
          this.speak(msg);
        }
      } else {
        // Bad-form rep — give feedback but don't count toward the set.
        this.speak(outcome.message + ' Keep going!');
      }
    }
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function renderVoiceStatus() {
  const coach = window.voiceCoach;
  const phaseEl    = document.getElementById('voicePhase');
  const progressEl = document.getElementById('voiceSetProgress');
  if (!phaseEl) return;

  const labels = {
    IDLE:       'Say "start" to begin a session',
    FORM_CHECK: 'Form check — do one rep',
    SET_5:      'Set in progress',
  };
  phaseEl.textContent    = labels[coach.phase] ?? '';
  progressEl.textContent = coach.phase === 'SET_5' ? `${coach.setReps} / 5 reps` : '';
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

window.voiceCoach = new VoiceCoach();

const loadBtn      = document.getElementById('loadVoiceBtn');
const voiceStatusEl = document.getElementById('voiceStatus');

loadBtn?.addEventListener('click', () => {
  loadBtn.disabled = true;
  loadBtn.textContent = 'Activating…';

  window.voiceCoach.initTTS();
  const hasMic = window.voiceCoach.initSTT();

  voiceStatusEl.textContent = hasMic
    ? 'Ready. Start the camera, then say "start".'
    : 'Voice ready (speech recognition unavailable in this browser).';

  loadBtn.textContent = 'Voice Active';
  loadBtn.classList.add('voice-active');
  document.getElementById('voiceSessionInfo').style.display = '';
  renderVoiceStatus();
});
