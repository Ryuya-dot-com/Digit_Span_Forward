(() => {
  "use strict";

  const CONFIG = {
    mode: "forward",
    practiceDigits: ["483", "725", "960"], // 3桁×3本（固定）
    main: {
      minDigits: 3,
      maxDigits: 9,
      trialsPerLevel: 12,
    },
    timing: {
      preDigitsMs: 400,
      interDigitMs: 120,
      postDigitsMs: 200,
      postBeepMs: 100,
      nextTrialDelayMs: 300,
    },
    audio: {
      digitsDir: "./audio/digits",
      beep: "./audio/beep.wav",
    },
  };

  const el = {};
  const audioCache = new Map();
  let practiceTrials = [];
  let mainTrials = [];
  let results = [];
  let participantId = "";
  let mode = "practice"; // practice | main
  let running = false;
  let currentIndex = -1;
  let responseStart = null;

  document.addEventListener("DOMContentLoaded", () => {
    bindElements();
    attachEvents();
    setPracticeListText();
    showScreen("intro");
  });

  function bindElements() {
    el.screenIntro = document.getElementById("screen-intro");
    el.screenPractice = document.getElementById("screen-practice");
    el.screenMain = document.getElementById("screen-main");
    el.screenDone = document.getElementById("screen-done");

    el.participantId = document.getElementById("participant-id");
    el.introStart = document.getElementById("intro-start");

    el.practiceStart = document.getElementById("practice-start");
    el.skipPractice = document.getElementById("skip-practice");
    el.practiceStatus = document.getElementById("practice-status");
    el.practiceInput = document.getElementById("practice-input");
    el.practiceSubmit = document.getElementById("practice-submit");
    el.practiceList = document.getElementById("practice-list");

    el.mainStatus = document.getElementById("main-status");
    el.mainInput = document.getElementById("main-input");
    el.mainSubmit = document.getElementById("main-submit");

    el.downloadResults = document.getElementById("download-results");
    el.restart = document.getElementById("restart");
  }

  function attachEvents() {
    el.participantId.addEventListener("input", () => {
      participantId = el.participantId.value.trim();
      el.introStart.disabled = participantId.length === 0;
    });

    el.introStart.addEventListener("click", async () => {
      buildTrials();
      showScreen("practice");
    });

    el.practiceStart.addEventListener("click", () => beginSession("practice"));
    el.skipPractice.addEventListener("click", () => {
      mode = "main";
      resetInputs();
      showScreen("main");
      beginSession("main");
    });

    el.practiceSubmit.addEventListener("click", handleSubmit);
    el.practiceInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    });

    el.mainSubmit.addEventListener("click", handleSubmit);
    el.mainInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    });

    el.downloadResults.addEventListener("click", downloadResults);
    el.restart.addEventListener("click", restartAll);
  }

  function setPracticeListText() {
    if (!el.practiceList) return;
    el.practiceList.textContent = CONFIG.practiceDigits.join(" / ");
  }

  function showScreen(name) {
    const screens = ["intro", "practice", "main", "done"];
    screens.forEach((s) => {
      const visible = s === name;
      document.getElementById(`screen-${s}`).classList.toggle("hidden", !visible);
    });
  }

  function buildTrials() {
    practiceTrials = CONFIG.practiceDigits.map((digits, idx) => ({
      index: idx,
      digits,
      level: 3,
    }));
    const { minDigits, maxDigits, trialsPerLevel } = CONFIG.main;
    const pool = [];
    for (let len = minDigits; len <= maxDigits; len++) {
      for (let i = 0; i < trialsPerLevel; i++) {
        pool.push({
          index: pool.length,
          digits: generateDigits(len),
          level: len,
        });
      }
    }
    mainTrials = pool;
  }

  function generateDigits(length) {
    const digits = [];
    let prev = null;
    for (let i = 0; i < length; i++) {
      let d;
      do {
        d = Math.floor(Math.random() * 10).toString();
      } while (d === prev); // avoid consecutive repetition
      digits.push(d);
      prev = d;
    }
    return digits.join("");
  }

  function currentTrialList() {
    return mode === "practice" ? practiceTrials : mainTrials;
  }

  async function beginSession(targetMode) {
    if (running) return;
    mode = targetMode;
    running = true;
    results = mode === "main" ? [] : results;
    currentIndex = -1;
    resetInputs();
    updateStatus("提示中…", mode);
    await warmupAudio();
    await nextTrial();
  }

  function resetInputs() {
    responseStart = null;
    if (el.practiceInput) {
      el.practiceInput.value = "";
      el.practiceInput.disabled = true;
    }
    if (el.practiceSubmit) el.practiceSubmit.disabled = true;
    if (el.mainInput) {
      el.mainInput.value = "";
      el.mainInput.disabled = true;
    }
    if (el.mainSubmit) el.mainSubmit.disabled = true;
  }

  async function warmupAudio() {
    // preload digits 0-9 and beep
    const tasks = [];
    for (let d = 0; d <= 9; d++) {
      tasks.push(ensureAudioCached(digitSrc(d.toString())));
    }
    if (CONFIG.audio.beep) {
      tasks.push(ensureAudioCached(CONFIG.audio.beep));
    }
    await Promise.all(tasks);
  }

  function digitSrc(d) {
    return `${CONFIG.audio.digitsDir}/${d}.mp3`;
  }

  async function ensureAudioCached(src) {
    if (audioCache.has(src)) return audioCache.get(src);
    return new Promise((resolve, reject) => {
      const audio = new Audio(src);
      audio.preload = "auto";
      const cleanup = () => {
        audio.removeEventListener("canplaythrough", onReady);
        audio.removeEventListener("error", onError);
      };
      const onReady = () => {
        cleanup();
        audioCache.set(src, audio);
        resolve(audio);
      };
      const onError = () => {
        cleanup();
        reject(new Error(`音声を読み込めません: ${src}`));
      };
      audio.addEventListener("canplaythrough", onReady);
      audio.addEventListener("error", onError);
      audio.load();
    });
  }

  async function playAudio(src) {
    const audio = audioCache.has(src) ? audioCache.get(src) : await ensureAudioCached(src);
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((e) => console.error("再生エラー", e));
    }
    return new Promise((resolve) => {
      const cleanup = () => {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onEnded);
      };
      const onEnded = () => {
        cleanup();
        resolve();
      };
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onEnded);
    });
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function playDigits(digits) {
    const chars = digits.split("");
    for (let i = 0; i < chars.length; i++) {
      await playAudio(digitSrc(chars[i]));
      if (i !== chars.length - 1 && CONFIG.timing.interDigitMs > 0) {
        await wait(CONFIG.timing.interDigitMs);
      }
    }
  }

  async function nextTrial() {
    const list = currentTrialList();
    currentIndex += 1;
    if (currentIndex >= list.length) {
      finishSession();
      return;
    }
    const trial = list[currentIndex];
    resetInputs();
    updateStatus("提示中…（音声に集中してください）", mode);

    await wait(CONFIG.timing.preDigitsMs);
    await playDigits(trial.digits);
    await wait(CONFIG.timing.postDigitsMs);
    if (CONFIG.audio.beep) {
      await playAudio(CONFIG.audio.beep);
    }
    await wait(CONFIG.timing.postBeepMs);

    responseStart = performance.now();
    const inputEl = mode === "practice" ? el.practiceInput : el.mainInput;
    const submitEl = mode === "practice" ? el.practiceSubmit : el.mainSubmit;
    inputEl.disabled = false;
    submitEl.disabled = false;
    inputEl.value = "";
    inputEl.focus({ preventScroll: true });
    updateStatus("入力してください。Enterで送信。", mode);
  }

  function handleSubmit() {
    if (!running || responseStart === null) return;
    const list = currentTrialList();
    const trial = list[currentIndex];
    const inputEl = mode === "practice" ? el.practiceInput : el.mainInput;

    const raw = inputEl.value.trim();
    const response = raw.replace(/\s+/g, "");
    const correct = response === trial.digits;
    const rt = Math.round(performance.now() - responseStart);

    if (mode === "main") {
      results.push({
        participantId,
        mode: CONFIG.mode,
        trial: currentIndex + 1,
        level: trial.level,
        target: trial.digits,
        response,
        correct,
        rt,
      });
    }

    responseStart = null;
    updateStatus("記録しました。", mode);
    resetInputs();

    setTimeout(() => {
      if (running) nextTrial();
    }, CONFIG.timing.nextTrialDelayMs);
  }

  function updateStatus(text, which) {
    if (which === "practice") {
      el.practiceStatus.textContent = text;
    } else if (which === "main") {
      el.mainStatus.textContent = text;
    }
  }

  function finishSession() {
    if (mode === "practice") {
      running = false;
      mode = "main";
      showScreen("main");
      updateStatus("本試行を開始します。", "main");
      beginSession("main");
      return;
    }
    running = false;
    showScreen("done");
    el.downloadResults.disabled = results.length === 0;
  }

  function downloadResults() {
    if (results.length === 0) return;
    const header = ["participant_id", "mode", "trial", "level", "target", "response", "correct", "rt_ms"].join(
      ","
    );
    const lines = results.map((r) =>
      [r.participantId, r.mode, r.trial, r.level, r.target, r.response, r.correct ? 1 : 0, r.rt].join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
    a.href = url;
    a.download = `digitspan_forward_${now}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function restartAll() {
    running = false;
    mode = "practice";
    currentIndex = -1;
    responseStart = null;
    results = [];
    resetInputs();
    el.participantId.value = "";
    el.introStart.disabled = true;
    showScreen("intro");
  }
})();
