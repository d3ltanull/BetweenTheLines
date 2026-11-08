(() => {
  "use strict";

  const FALLBACK_CONFIG = {
    projectTitle: "МЕЖДУ СТРОК",
    filmTitle: "МЕЖДУ СТРОК",
    startDate: "2026-09-29T16:20:00",
    timezone: "Europe/Moscow",
    titleCard: {
      fadeIn: "FADE IN",
      reelLabel: "REEL 001",
      sceneLabel: "SCENE 01",
      tagline: "A FILM IN PROGRESS",
      name: "[ИМЯ]",
      subtitle: "[ПОДЗАГОЛОВОК]",
      phrase: "[КОРОТКАЯ ФРАЗА]",
      technical: "35MM  •  B/W  •  WORK PRINT"
    },
    copy: {
      dailyTitle: "КАДР ДНЯ",
      filmTitle: "НАШ ФИЛЬМ",
      unshotTitle: "ЕЩЁ НЕ СНЯТО",
      unshotLine: "[СЦЕНА ЕЩЁ НЕ СНЯТА]",
      unshotNote: "История продолжается. Финальных титров пока нет.",
      counterRunning: "НАШ ФИЛЬМ ИДЁТ УЖЕ",
      counterWaiting: "ДО ПЕРВОГО КАДРА",
      fadeOut: "FADE OUT",
      endCard: "THE END IS NOT YET WRITTEN",
      missingImage: "[КАДР ПОКА НЕ ДОБАВЛЕН]",
      missingText: "[ТЕКСТ ПОКА НЕ ДОБАВЛЕН]",
      missingQuote: "[ЦИТАТА ПОКА НЕ ДОБАВЛЕНА]",
      soundOn: "SOUND ON",
      soundOff: "SOUND OFF",
      soundUnavailable: "SOUND — NO REEL"
    },
    effects: {
      grain: 0.11,
      flicker: 0.035,
      scratches: 0.07,
      jitter: 0.28,
      ripple: 0.025,
      dust: 0.6,
      speed: 1
    },
    audio: { src: "", loop: true, volume: 0.32 },
    features: {
      filmEffects: true,
      sideReels: true,
      audio: true,
      unshotScene: true,
      introFade: true,
      scrollReveal: true
    }
  };

  const SOUND_KEY = "btl-sound";
  const MISSING_FRAME = "assets/images/decorative/missing-frame.svg";
  const SUPABASE_URL = "https://wnexlkpryzinaksuosir.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_0g1GD5JLg3hPyD6ibd9YZQ_kttgRLDq";

  const $ = (id) => document.getElementById(id);

  async function loadJSON(path) {
    try {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function tzOffsetMs(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);

    const get = (type) => {
      const part = parts.find((p) => p.type === type);
      return part ? Number(part.value) : 0;
    };

    const asUTC = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second")
    );
    return asUTC - date.getTime();
  }

  function zonedDateTimeToUtc(localISO, timeZone) {
    const naive = new Date(`${localISO}Z`);
    if (Number.isNaN(naive.getTime())) return new Date(NaN);
    const guess = new Date(naive.getTime() - tzOffsetMs(naive, timeZone));
    return new Date(naive.getTime() - tzOffsetMs(guess, timeZone));
  }

  function padTime(time) {
    if (!time) return "00:00:00";
    const parts = String(time).split(":");
    while (parts.length < 3) parts.push("00");
    return parts.map((p) => String(p).padStart(2, "0")).join(":");
  }

  function sceneInstant(scene, timeZone) {
    const date = scene && scene.date ? scene.date : "1970-01-01";
    const time = padTime(scene && scene.time);
    if (scene && scene.timestamp) {
      const fromStamp = new Date(scene.timestamp);
      if (!Number.isNaN(fromStamp.getTime())) return fromStamp;
    }
    return zonedDateTimeToUtc(`${date}T${time}`, timeZone);
  }

  function todayInZone(timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  function formatCinemaDate(isoDate, timeZone) {
    const instant = zonedDateTimeToUtc(`${isoDate}T12:00:00`, timeZone);
    if (Number.isNaN(instant.getTime())) return isoDate || "[ДАТА]";
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "2-digit",
      month: "long",
      year: "numeric"
    })
      .format(instant)
      .toUpperCase();
  }

  function textOr(value, fallback) {
    if (value === null || value === undefined) return fallback;
    const str = String(value).trim();
    return str ? str : fallback;
  }

  function pickByDate(bundle, isoDate) {
    const entries = bundle && Array.isArray(bundle.entries) ? bundle.entries : [];
    const match = entries.find((entry) => entry && entry.date === isoDate);
    if (match) return match;
    return (bundle && bundle.default) || {};
  }

  function createSupabaseClient() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") return null;
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  function mergeDaily(localDaily, remoteRows) {
    const bundle = {
      default: (localDaily && localDaily.default) || {},
      entries: Array.isArray(localDaily && localDaily.entries) ? [...localDaily.entries] : []
    };
    const byDate = new Map();
    bundle.entries.forEach((entry) => {
      if (entry && entry.date) byDate.set(String(entry.date), entry);
    });
    (Array.isArray(remoteRows) ? remoteRows : []).forEach((row) => {
      if (!row || !row.date) return;
      byDate.set(String(row.date), row);
    });
    bundle.entries = Array.from(byDate.values());
    return bundle;
  }

  async function loadApprovedDaily(client) {
    if (!client) return [];
    try {
      const { data, error } = await client.from("daily").select("*").eq("approved", true);
      if (error || !Array.isArray(data)) return [];
      return data;
    } catch {
      return [];
    }
  }

  function applyEffects(config) {
    const fx = { ...FALLBACK_CONFIG.effects, ...(config.effects || {}) };
    const root = document.documentElement;
    root.style.setProperty("--grain", String(fx.grain));
    root.style.setProperty("--flicker", String(fx.flicker));
    root.style.setProperty("--scratches", String(fx.scratches));
    root.style.setProperty("--jitter", String(fx.jitter));
    root.style.setProperty("--ripple", String(fx.ripple));
    root.style.setProperty("--dust", String(fx.dust));
    root.style.setProperty("--fx-speed", String(fx.speed || 1));

    if (!config.features.filmEffects) $("film-fx")?.classList.add("is-hidden");
    if (!config.features.sideReels) $("film-reels")?.classList.add("is-hidden");
    if (!config.features.introFade) $("intro-veil")?.classList.add("is-hidden");
  }

  function bindTitle(config) {
    const card = config.titleCard || {};
    const map = {
      fadeIn: card.fadeIn,
      reelLabel: card.reelLabel,
      sceneLabel: card.sceneLabel,
      projectTitle: config.projectTitle,
      tagline: card.tagline,
      name: card.name,
      subtitle: card.subtitle,
      phrase: card.phrase,
      technical: card.technical
    };
    document.querySelectorAll("[data-bind]").forEach((el) => {
      const key = el.getAttribute("data-bind");
      if (key && map[key] != null) el.textContent = map[key];
    });
    document.title = config.projectTitle || "BETWEEN THE LINES";
    const dailyHeading = $("daily-heading");
    if (dailyHeading) dailyHeading.textContent = config.copy.dailyTitle;
    const filmHeading = $("film-heading");
    if (filmHeading) filmHeading.textContent = config.copy.filmTitle;
    const endCue = document.querySelector(".end-card__cue");
    if (endCue) endCue.textContent = config.copy.fadeOut;
    const endLine = document.querySelector(".end-card__line");
    if (endLine) endLine.textContent = config.copy.endCard;
  }

  function renderGreeting(config, greetings) {
    const today = todayInZone(config.timezone);
    const entry = pickByDate(greetings, today);
    $("greeting-date").textContent = formatCinemaDate(today, config.timezone);
    $("greeting-text").textContent = textOr(entry.greeting, "[ПРИВЕТСТВИЕ]");
    $("greeting-phrase").textContent = textOr(entry.phrase, "[КОРОТКАЯ ФРАЗА]");
    const note = $("greeting-note");
    const noteText = textOr(entry.note, "");
    if (!noteText) {
      note.classList.add("is-hidden");
    } else {
      note.textContent = noteText;
    }
  }

  function missingFrame(label) {
    const wrap = document.createElement("div");
    wrap.className = "frame-missing";
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label", label);
    wrap.textContent = label;
    return wrap;
  }

  function bindImg(container, src, alt, missingLabel) {
    container.innerHTML = "";
    if (!src) {
      container.appendChild(missingFrame(missingLabel));
      return;
    }
    const img = document.createElement("img");
    img.alt = textOr(alt, missingLabel);
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("error", () => {
      container.innerHTML = "";
      container.appendChild(missingFrame(missingLabel));
    });
    img.src = src;
    container.appendChild(img);
  }

  function renderQuiz(host, quiz, copy) {
    if (!quiz || !Array.isArray(quiz.options) || !quiz.options.length) return;
    const box = document.createElement("div");
    box.className = "quiz";
    const q = document.createElement("p");
    q.className = "quiz__question";
    q.textContent = textOr(quiz.question, "[ВОПРОС]");
    const list = document.createElement("ul");
    list.className = "quiz__options";
    const reveal = document.createElement("p");
    reveal.className = "quiz__reveal is-hidden";
    reveal.textContent = textOr(quiz.reveal, copy.missingText);

    let answered = false;
    quiz.options.forEach((opt) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz__option";
      btn.textContent = textOr(opt.text, "[ВАРИАНТ]");
      btn.addEventListener("click", () => {
        if (answered) return;

        if (opt.correct) {
          answered = true;
          btn.classList.add("is-correct");

          list.querySelectorAll("button").forEach((b) => {
            b.disabled = true;
          });

          reveal.textContent = textOr(quiz.reveal, copy.missingText);
          reveal.classList.remove("is-hidden");
        } else {
          btn.classList.add("is-wrong");
          reveal.textContent = "Подумай ещё";
          reveal.classList.remove("is-hidden");
        }
      });
      li.appendChild(btn);
      list.appendChild(li);
    });

    box.append(q, list, reveal);
    host.appendChild(box);
  }

  function renderDaily(config, daily) {
    const today = todayInZone(config.timezone);
    const entry = pickByDate(daily, today);
    const frame = $("daily-frame");
    frame.innerHTML = "";

    const kicker = document.createElement("p");
    kicker.className = "daily__kicker type-tech";
    kicker.textContent = textOr(entry.kicker, "TODAY'S FRAME");
    frame.appendChild(kicker);

    const title = document.createElement("h3");
    title.className = "daily__title";
    title.textContent = textOr(entry.title, "[КАДР ДНЯ]");
    frame.appendChild(title);

    if (entry.image || entry.type === "image" || entry.type === "meme") {
      const media = document.createElement("figure");
      media.className = "daily__media";
      bindImg(media, entry.image, entry.imageAlt, config.copy.missingImage);
      frame.appendChild(media);
    }

    const text = document.createElement("p");
    text.className = "daily__text";
    text.textContent = textOr(entry.text, config.copy.missingText);
    frame.appendChild(text);

    if (entry.extra) {
      const extra = document.createElement("p");
      extra.className = "daily__extra";
      extra.textContent = entry.extra;
      frame.appendChild(extra);
    }

    if (entry.quote) {
      const quote = document.createElement("blockquote");
      quote.className = "daily__quote";
      quote.textContent = entry.quote;
      frame.appendChild(quote);
    }

    if (entry.type === "quiz" || entry.quiz) {
      renderQuiz(frame, entry.quiz, config.copy);
    }

    if (entry.audio && entry.audio.src) {
      const playerWrap = document.createElement("div");
      playerWrap.className = "daily-player";
      playerWrap.innerHTML = `
        <div class="daily-player__sprockets daily-player__sprockets--top"></div>
        <div class="daily-player__header">
          <span class="daily-player__tag type-tech">ЗВУКОВАЯ ДОРОЖКА</span>
          <span class="daily-player-time">0:00</span>
        </div>
        <div class="daily-player-info">
          <span class="daily-player-title">${entry.audio.title || "ТРЕК ДНЯ"}</span>
          <span class="daily-player-artist">${entry.audio.artist || ""}</span>
        </div>
        <div class="daily-player-controls">
          <button class="daily-play-btn" type="button" aria-label="Play">
            <svg class="play-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            <svg class="pause-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          </button>
          <div class="daily-progress-container">
            <div class="daily-progress-bar"></div>
          </div>
        </div>
        <audio src="${entry.audio.src}" preload="metadata"></audio>
      `;
      frame.appendChild(playerWrap);
    }
  }

  function initDailyAudioPlayers() {
    document.querySelectorAll(".daily-player").forEach((playerEl) => {
      const audio = playerEl.querySelector("audio");
      const playBtn = playerEl.querySelector(".daily-play-btn");
      const playIcon = playerEl.querySelector(".play-icon");
      const pauseIcon = playerEl.querySelector(".pause-icon");
      const progressContainer = playerEl.querySelector(".daily-progress-container");
      const progressBar = playerEl.querySelector(".daily-progress-bar");
      const timeEl = playerEl.querySelector(".daily-player-time");

      if (!audio || !playBtn) return;

      playBtn.addEventListener("click", () => {
        if (audio.paused) {
          document.querySelectorAll("audio").forEach((a) => {
            if (a !== audio) {
              a.pause();
              a.dispatchEvent(new Event("pause"));
            }
          });
          audio.play();
        } else {
          audio.pause();
        }
      });

      audio.addEventListener("play", () => {
        playIcon.style.display = "none";
        pauseIcon.style.display = "block";
      });

      audio.addEventListener("pause", () => {
        playIcon.style.display = "block";
        pauseIcon.style.display = "none";
      });

      audio.addEventListener("timeupdate", () => {
        if (!audio.duration) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = `${pct}%`;

        const mins = Math.floor(audio.currentTime / 60);
        const secs = Math.floor(audio.currentTime % 60).toString().padStart(2, "0");
        timeEl.textContent = `${mins}:${secs}`;
      });

      progressContainer.addEventListener("click", (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        if (audio.duration) {
          audio.currentTime = (clickX / width) * audio.duration;
        }
      });

      audio.addEventListener("ended", () => {
        playIcon.style.display = "block";
        pauseIcon.style.display = "none";
        progressBar.style.width = "0%";
        audio.currentTime = 0;
      });
    });
  }

  function sceneNumberLabel(scene, index) {
    const n = Number.isFinite(Number(scene.number)) ? Number(scene.number) : index + 1;
    return `SCENE ${String(n).padStart(2, "0")}`;
  }

  function renderScene(scene, index, config) {
    const li = document.createElement("li");
    li.className = "scene";
    li.id = scene.id || `scene-${index + 1}`;

    const card = document.createElement("article");
    card.className = "scene-card";

    const head = document.createElement("div");
    head.className = "scene-card__head";
    const num = document.createElement("span");
    num.textContent = sceneNumberLabel(scene, index);
    const date = document.createElement("span");
    date.textContent = formatCinemaDate(scene.date, config.timezone);
    const time = document.createElement("span");
    time.textContent = scene.time || "";
    head.append(num, date, time);
    card.appendChild(head);

    const title = document.createElement("h3");
    title.className = "scene-card__title";
    title.textContent = textOr(scene.title, "[НАЗВАНИЕ СЦЕНЫ]");
    card.appendChild(title);

    const location = document.createElement("p");
    location.className = "scene-card__location";
    location.textContent = textOr(scene.location, "[МЕСТО]");
    card.appendChild(location);
    
    if (scene.video || Object.prototype.hasOwnProperty.call(scene, "image")) {
      const media = document.createElement("figure");
      media.className = "scene-card__media";

      if (scene.video) {
        const video = document.createElement("video");
        video.muted = true;
        video.defaultMuted = true;
        video.volume = 0;
        video.autoplay = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.setAttribute("aria-label", textOr(scene.imageAlt, "Видео сцены"));

        const source = document.createElement("source");
        source.src = scene.video;
        source.type = "video/mp4";

        video.appendChild(source);
        media.appendChild(video);
      } else {
        bindImg(
          media,
          scene.image,
          scene.imageAlt,
          config.copy.missingImage
        );
      }

      card.appendChild(media);
    }

    const body = document.createElement("div");
    body.className = "scene-card__body";

    const desc = document.createElement("p");
    desc.textContent = textOr(scene.description, config.copy.missingText);
    body.appendChild(desc);

    if (scene.quote) {
      const quote = document.createElement("blockquote");
      quote.className = "scene-card__quote";
      quote.textContent = scene.quote;
      body.appendChild(quote);
    }

    if (scene.voiceOver) {
      const vo = document.createElement("p");
      vo.className = "scene-card__vo";
      vo.textContent = scene.voiceOver;
      body.appendChild(vo);
    }

    if (scene.notes) {
      const notes = document.createElement("p");
      notes.className = "scene-card__notes";
      notes.textContent = scene.notes;
      body.appendChild(notes);
    }

    if (scene.metadata && typeof scene.metadata === "object") {
      const meta = document.createElement("ul");
      meta.className = "scene-card__meta";
      Object.entries(scene.metadata).forEach(([key, value]) => {
        if (value == null || value === "") return;
        const item = document.createElement("li");
        item.textContent = `${key}: ${value}`;
        meta.appendChild(item);
      });
      if (meta.childElementCount) body.appendChild(meta);
    }

    card.appendChild(body);
    li.appendChild(card);
    return li;
  }

  function renderUnshot(config) {
    const li = document.createElement("li");
    li.className = "scene scene--unshot";
    li.id = "scene-unshot";
    const card = document.createElement("article");
    card.className = "scene-card";
    const head = document.createElement("div");
    head.className = "scene-card__head";
    const title = document.createElement("h3");
    title.className = "scene-card__title";
    title.textContent = config.copy.unshotTitle;
    const location = document.createElement("p");
    location.className = "scene-card__location";
    location.textContent = config.copy.unshotLine;
    const body = document.createElement("p");
    body.textContent = config.copy.unshotNote;
    card.append(head, title, location, body);
    li.appendChild(card);
    return li;
  }

  function renderActionCard() {
    const li = document.createElement("li");
    li.className = "scene scene--action";
    li.innerHTML = `
      <button class="timeline-trigger-card" id="timeline-submit-open" type="button">
        <h3 class="timeline-trigger-card__title">ДОБАВИТЬ СВОЙ КАДР В ХРОНИКУ</h3>
        <p class="timeline-trigger-card__sub">Нажмите, чтобы вписать новую сцену в историю</p>
      </button>
    `;
    return li;
  }

  function renderTimeline(config, timeline) {
    const host = $("timeline");
    host.innerHTML = "";
    const scenes = Array.isArray(timeline && timeline.scenes) ? [...timeline.scenes] : [];
    scenes.sort((a, b) => sceneInstant(a, config.timezone) - sceneInstant(b, config.timezone));
    
    // 1. Отрисовываем все текущие сцены
    scenes.forEach((scene, index) => {
      host.appendChild(renderScene(scene || {}, index, config));
    });

    // 2. Вставляем кнопку добавления сцены
    host.appendChild(renderActionCard());

    // 3. Вставляем плашку "ЕЩЁ НЕ СНЯТО" в самом конце
    if (config.features.unshotScene) {
      host.appendChild(renderUnshot(config));
    }
  }

  function pad(n, size) {
    return String(Math.max(0, n)).padStart(size, "0");
  }

  function startCounter(config) {
    const start = zonedDateTimeToUtc(config.startDate, config.timezone);
    const title = $("counter-heading");
    const status = $("counter-status");

    const tick = () => {
      const now = Date.now();
      const startMs = start.getTime();
      if (Number.isNaN(startMs)) {
        title.textContent = config.copy.counterRunning;
        status.textContent = "[ДАТА НАЧАЛА НЕ ЗАДАНА]";
        return;
      }

      const started = now >= startMs;
      const diff = Math.abs(now - startMs);
      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      title.textContent = started ? config.copy.counterRunning : config.copy.counterWaiting;
      status.textContent = started ? "" : formatCinemaDate(config.startDate.slice(0, 10), config.timezone);

      $("count-days").textContent = pad(days, 3);
      $("count-hours").textContent = pad(hours, 2);
      $("count-minutes").textContent = pad(minutes, 2);
      $("count-seconds").textContent = pad(seconds, 2);

      const grid = $("counter-grid");
      grid.setAttribute(
        "aria-label",
        `${started ? config.copy.counterRunning : config.copy.counterWaiting}: ${days} дней, ${hours} часов, ${minutes} минут, ${seconds} секунд`
      );
    };

    tick();
    window.setInterval(tick, 1000);
  }

  function showSlateNotice(message) {
    const notice = $("slate-notice");
    const text = $("slate-notice-text");
    if (!notice || !text) return;
    text.textContent = message;
    notice.hidden = false;
    notice.classList.remove("is-hidden");
    window.clearTimeout(showSlateNotice.timer);
    showSlateNotice.timer = window.setTimeout(() => {
      notice.hidden = true;
      notice.classList.add("is-hidden");
    }, 4200);
  }

  function initTimelineSubmit(config, client) {
    const modal = $("timeline-modal");
    const panel = $("timeline-modal-panel");
    const form = $("timeline-submit-form");
    const cancelBtn = $("timeline-submit-cancel");
    const veil = $("timeline-modal-veil");
    const dateInput = $("timeline-date");
    const imageInput = $("timeline-image");
    const sendBtn = $("timeline-submit-send");

    // Делегирование клика для динамически создаваемой кнопки в хронологии
    document.addEventListener("click", (e) => {
      const openBtn = e.target.closest("#timeline-submit-open");
      if (openBtn) {
        openModal();
      }
    });

    if (!modal || !form) return;

    let lastFocus = null;

    const openModal = () => {
      lastFocus = document.activeElement;
      modal.hidden = false;
      modal.classList.remove("is-hidden");
      if (dateInput && !dateInput.value) dateInput.value = todayInZone(config.timezone);
      (dateInput || panel).focus();
    };

    const closeModal = () => {
      modal.hidden = true;
      modal.classList.add("is-hidden");
      form.reset();
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    };

    cancelBtn?.addEventListener("click", closeModal);
    veil?.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!client) {
        showSlateNotice("Архив сейчас недоступен.");
        return;
      }

      const titleVal = String(form.title ? form.title.value : "").trim();
      const dateVal = String(form.date ? form.date.value : "").trim();
      const timeVal = String(form.time ? form.time.value : "").trim();
      const locVal = String(form.location ? form.location.value : "").trim();
      const descVal = String(form.description ? form.description.value : "").trim();
      const quoteVal = String(form.quote ? form.quote.value : "").trim();
      const notesVal = String(form.notes ? form.notes.value : "").trim();
      const file = imageInput?.files ? imageInput.files[0] : null;

      // Проверка обязательных полей
      if (!titleVal || !dateVal || !timeVal || !locVal || !descVal || !file) {
        showSlateNotice("Заполни все обязательные поля кадра.");
        return;
      }

      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = "ПРОЯВКА КАДРА...";
      }

      try {
        // 1. Загрузка файла в Supabase Storage (timeline-media)
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

        const { error: uploadError } = await client.storage
          .from("timeline-media")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          showSlateNotice("Ошибка при загрузке кадра в хранилище.");
          return;
        }

        // 2. Получение публичного URL файла
        const { data: publicUrlData } = client.storage
          .from("timeline-media")
          .getPublicUrl(fileName);

        // 3. Формирование объекта данных с гарантией типов
        const payload = {
          title: titleVal,
          date: dateVal,
          time: timeVal,
          location: locVal,
          description: descVal,
          image: publicUrlData.publicUrl,
          quote: quoteVal ? quoteVal : null,
          notes: notesVal ? notesVal : null,
          approved: false
        };

        // 4. Отправка записи в таблицу timeline
        const { error: insertError } = await client.from("timeline").insert([payload]);

        if (insertError) {
          console.error("Database insert error:", insertError);
          showSlateNotice("Пленка застряла в камере. Попробуй ещё раз.");
          return;
        }

        closeModal();
        showSlateNotice("Новый кадр хроники отправлен и ждет утверждения");
      } catch (err) {
        console.error("Unexpected submission error:", err);
        showSlateNotice("Пленка застряла в камере. Попробуй еще раз.");
      } finally {
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.textContent = "СДАТЬ В АРХИВ";
        }
      }
    });
  }
  
  function initDailySubmit(config, client) {
    const modal = $("daily-modal");
    const panel = $("daily-modal-panel");
    const form = $("daily-submit-form");
    const openBtn = $("daily-submit-open");
    const cancelBtn = $("daily-submit-cancel");
    const veil = $("daily-modal-veil");
    const dateInput = $("daily-date");
    const imageInput = $("daily-image");
    const sendBtn = $("daily-submit-send");
    if (!modal || !form || !openBtn) return;

    let lastFocus = null;

    const openModal = () => {
      lastFocus = document.activeElement;
      modal.hidden = false;
      modal.classList.remove("is-hidden");
      if (dateInput && !dateInput.value) dateInput.value = todayInZone(config.timezone);
      (dateInput || panel).focus();
    };

    const closeModal = () => {
      modal.hidden = true;
      modal.classList.add("is-hidden");
      form.reset();
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    };

    openBtn.addEventListener("click", openModal);
    cancelBtn?.addEventListener("click", closeModal);
    veil?.addEventListener("click", closeModal);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) closeModal();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!client) {
        showSlateNotice("Архив сейчас недоступен. Кадр не удалось сдать.");
        return;
      }

      const dateVal = String(form.date.value || "").trim();
      const titleVal = String(form.title.value || "").trim();
      const textVal = String(form.text.value || "").trim();
      const file = imageInput?.files ? imageInput.files[0] : null;

      if (!dateVal || !titleVal || !textVal || !file) {
        showSlateNotice("Неполный дубль. Заполни дату, название, текст и прикрепи кадр.");
        return;
      }

      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = "ПРОЯВКА КАДРА...";
      }

      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

        const { error: uploadError } = await client.storage
          .from("daily-images")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });

        if (uploadError) {
          showSlateNotice("Ошибка при загрузке кадра в хранилище");
          return;
        }

        const { data: publicUrlData } = client.storage
          .from("daily-images")
          .getPublicUrl(fileName);

        const payload = {
          date: dateVal,
          title: titleVal,
          image: publicUrlData.publicUrl,
          text: textVal,
          type: "image",
          kicker: "NEW FRAME",
          approved: false
        };

        const { error: insertError } = await client.from("daily").insert([payload]);

        if (insertError) {
          showSlateNotice("Пленка застряла в камере. Попробуй сдать кадр еще раз");
          return;
        }

        closeModal();
        showSlateNotice("Новый кадр отправлен в архив и ждет утверждения!");
      } catch {
        showSlateNotice("Пленка застряла в камере. Попробуй сдать кадр еще раз.");
      } finally {
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.textContent = "СДАТЬ В АРХИВ";
        }
      }
    });
  }

  function initAudio(config) {
    const btn = $("sound-toggle");
    const audio = $("score");
    const label = btn.querySelector(".sound-toggle__label");
    const src = config.audio && config.audio.src;
    const wanted = localStorage.getItem(SOUND_KEY) === "on";

    if (!config.features.audio) {
      btn.classList.add("is-hidden");
      return;
    }

    const setLabel = (on) => {
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      label.textContent = on ? config.copy.soundOn : config.copy.soundOff;
    };

    if (!src) {
      label.textContent = config.copy.soundUnavailable;
      btn.disabled = true;
      btn.title = "Добавьте файл в content/config.json → audio.src";
      return;
    }

    audio.src = src;
    audio.loop = config.audio.loop !== false;
    audio.volume = Number.isFinite(config.audio.volume) ? config.audio.volume : 0.32;
    setLabel(false);

    const tryPlay = async () => {
      try {
        await audio.play();
        setLabel(true);
        localStorage.setItem(SOUND_KEY, "on");
      } catch {
        setLabel(false);
      }
    };

    btn.addEventListener("click", async () => {
      if (audio.paused) {
        await tryPlay();
      } else {
        audio.pause();
        setLabel(false);
        localStorage.setItem(SOUND_KEY, "off");
      }
    });

    if (wanted) {
      btn.title = "Звук был включён в прошлый раз. Нажмите, чтобы продолжить.";
    }
  }

  
function initReveals(config) {
  if (!config.features.scrollReveal) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const nodes = document.querySelectorAll(".chapter, .end-card, .scene");

  if (!("IntersectionObserver" in window)) return;

  let observer;

  try {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.01,
        rootMargin: "0px 0px -20% 0px"
      }
    );

    nodes.forEach((node) => {
      node.classList.add("will-reveal");
      observer.observe(node);
    });
  } catch (error) {
    if (observer) observer.disconnect();
    nodes.forEach((node) => {
      node.classList.remove("will-reveal", "is-visible");
    });
  }
}


  function deepMerge(base, extra) {
    if (!extra || typeof extra !== "object") return base;
    const out = { ...base };
    Object.keys(extra).forEach((key) => {
      if (
        extra[key] &&
        typeof extra[key] === "object" &&
        !Array.isArray(extra[key]) &&
        base[key] &&
        typeof base[key] === "object"
      ) {
        out[key] = deepMerge(base[key], extra[key]);
      } else if (extra[key] !== undefined) {
        out[key] = extra[key];
      }
    });
    return out;
  }

  async function loadApprovedTimeline(client) {
    if (!client) return [];
    try {
      const { data, error } = await client.from("timeline").select("*").eq("approved", true);
      if (error || !Array.isArray(data)) return [];
      return data;
    } catch {
      return [];
    }
  }

  function mergeTimeline(localTimeline, remoteRows) {
    const localScenes = Array.isArray(localTimeline && localTimeline.scenes) ? [...localTimeline.scenes] : [];
    const combined = [...localScenes, ...(Array.isArray(remoteRows) ? remoteRows : [])];
    return { scenes: combined };
  }

  async function boot() {
    const [configRaw, greetings, daily, timeline] = await Promise.all([
      loadJSON("content/config.json"),
      loadJSON("content/greetings.json"),
      loadJSON("content/daily.json"),
      loadJSON("content/timeline.json")
    ]);

    const config = deepMerge(FALLBACK_CONFIG, configRaw || {});
    const localDaily = daily || { default: {} };
    const supabaseClient = createSupabaseClient();

    applyEffects(config);
    bindTitle(config);
    renderGreeting(config, greetings || { default: {} });
    renderDaily(config, localDaily);
    initDailyAudioPlayers();
    renderTimeline(config, timeline || { scenes: [] });
    startCounter(config);
    initAudio(config);
    initReveals(config);
    initDailySubmit(config, supabaseClient);
    initTimelineSubmit(config, supabaseClient);

    const approvedTimeline = await loadApprovedTimeline(supabaseClient);
    if (approvedTimeline.length) {
      renderTimeline(config, mergeTimeline(timeline || { scenes: [] }, approvedTimeline));
    }

    const approved = await loadApprovedDaily(supabaseClient);
    if (approved.length) {
      renderDaily(config, mergeDaily(localDaily, approved));
      initDailyAudioPlayers();
    }
  }

  if (typeof window !== "undefined") {
    window.BTL = {
      zonedDateTimeToUtc,
      sceneInstant,
      todayInZone,
      pickByDate
    };
  }

  boot();
})();
