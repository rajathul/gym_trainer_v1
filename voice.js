// Voice coaching module: SpeechSynthesis TTS + Web Speech API STT.
// Loaded as type="module". Exposes window.voiceCoach for app.js to call.
// Activated/deactivated via window.voiceCoach.enable() / .disable().

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
  #enabled = false;
  #initialized = false;

  get phase()     { return this.#phase; }
  get setReps()   { return this.#setReps; }
  get isEnabled() { return this.#enabled; }

  // ── Enable / Disable ─────────────────────────────────────────────────────

  enable() {
    this.#enabled = true;
    if (!this.#initialized) {
      this.#initTTS();
      this.#initSTT();
      this.#initialized = true;
      this.speak('Voice coach active. Say start to begin.');
    } else {
      this.#resumeSTT();
      this.speak('Voice coach back on. Say start to begin.');
    }
  }

  disable() {
    this.#enabled = false;
    this.#phase = 'IDLE';
    this.#setReps = 0;
    speechSynthesis.cancel();
    this.#queue = [];
    this.#speaking = false;
    this.#pauseSTT();
  }

  // ── TTS ──────────────────────────────────────────────────────────────────

  #initTTS() {
    const pickVoice = () => {
      const voices = speechSynthesis.getVoices();
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
    if (!this.#enabled) return;
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
      utt.onerror = resolve;
      speechSynthesis.speak(utt);
    });
  }

  // ── STT ──────────────────────────────────────────────────────────────────

  #initSTT() {
    const SR = window['SpeechRecognition'] || window['webkitSpeechRecognition'];
    if (!SR) return;

    this.#recognition = new SR();
    this.#recognition.continuous = true;
    this.#recognition.interimResults = false;
    this.#recognition.lang = 'en-US';

    this.#recognition.onresult = e => {
      if (!this.#enabled) return;
      const last = e.results[e.results.length - 1];
      if (!last.isFinal) return;
      const heard = last[0].transcript.toLowerCase().trim();
      if (heard.includes('start') && this.#phase === 'IDLE') {
        this.#startFormCheck();
      }
    };

    this.#recognition.onend = () => {
      if (!this.#sttPaused && this.#enabled) {
        try { this.#recognition.start(); } catch {}
      }
    };

    this.#recognition.start();
  }

  #pauseSTT() {
    this.#sttPaused = true;
    try { this.#recognition?.stop(); } catch {}
  }

  #resumeSTT() {
    this.#sttPaused = false;
    if (this.#enabled) {
      try { this.#recognition?.start(); } catch {}
    }
  }

  // ── Session state machine ─────────────────────────────────────────────────

  #startFormCheck() {
    this.#phase = 'FORM_CHECK';
    this.speak("Let's check your form. Do one squat rep.");
  }

  onRepComplete(outcome) {
    if (!this.#enabled || this.#phase === 'IDLE') return;

    if (this.#phase === 'FORM_CHECK') {
      if (outcome.isCorrect) {
        this.#phase = 'SET_5';
        this.#setReps = 0;
        this.speak("Great form! Now let's do a set of 5 reps. Go!");
      } else {
        this.speak(outcome.message + ' Try again.');
      }
      return;
    }

    if (this.#phase === 'SET_5') {
      if (outcome.isCorrect) {
        this.#setReps += 1;
        if (this.#setReps >= 5) {
          this.#phase = 'IDLE';
          this.#setReps = 0;
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
        this.speak(outcome.message + ' Keep going!');
      }
    }
  }
}

window.voiceCoach = new VoiceCoach();
