const API_BASE = 'https://equran.id/api/v2';

const state = {
  surahs: [],
  selectedSurah: null,
  activeView: 'quran',
  quizMode: 'guess',
  quiz: null,
  score: 0,
  questionNumber: 0,
  surahRequestId: 0
};

const elements = {
  surahList: document.querySelector('#surah-list'),
  surahListStatus: document.querySelector('#surah-list-status'),
  surahCount: document.querySelector('#surah-count'),
  surahSearch: document.querySelector('#surah-search'),
  detailStatus: document.querySelector('#surah-detail-status'),
  detail: document.querySelector('#surah-detail'),
  mentorSurahName: document.querySelector('#mentor-surah-name'),
  mentorSurahMeta: document.querySelector('#mentor-surah-meta'),
  quizContent: document.querySelector('#quiz-content'),
  quizModeLabel: document.querySelector('#quiz-mode-label'),
  questionNumber: document.querySelector('#question-number'),
  score: document.querySelector('#score'),
  nextQuestion: document.querySelector('#next-question'),
  restartQuiz: document.querySelector('#restart-quiz')
};

async function fetchApi(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Permintaan gagal (${response.status}).`);
  }

  const payload = await response.json();
  if (payload.code !== 200 || payload.data == null) {
    throw new Error(payload.message || 'Respons API tidak dapat digunakan.');
  }
  return payload.data;
}

function showView(viewName) {
  state.activeView = viewName;
  document.querySelector('#quran-view').hidden = viewName !== 'quran';
  document.querySelector('#mentor-view').hidden = viewName !== 'mentor';

  document.querySelectorAll('.nav-link').forEach((button) => {
    const isActive = button.dataset.view === viewName;
    button.classList.toggle('is-active', isActive);
    if (isActive) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  if (viewName === 'mentor') renderQuiz();
}

function renderSurahList(searchTerm = '') {
  const normalizedTerm = searchTerm.trim().toLocaleLowerCase('id');
  const matches = state.surahs.filter((surah) =>
    `${surah.namaLatin} ${surah.arti} ${surah.nomor}`.toLocaleLowerCase('id').includes(normalizedTerm)
  );

  elements.surahList.replaceChildren();
  if (!matches.length && state.surahs.length) {
    const empty = document.createElement('p');
    empty.className = 'no-results';
    empty.textContent = 'Surat tidak ditemukan.';
    elements.surahList.append(empty);
    return;
  }

  matches.forEach((surah) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `surah-item${state.selectedSurah?.nomor === surah.nomor ? ' is-selected' : ''}`;
    button.setAttribute('aria-label', `${surah.nomor}. ${surah.namaLatin}, ${surah.jumlahAyat} ayat`);

    const number = document.createElement('span');
    number.className = 'surah-number';
    number.textContent = surah.nomor;
    const name = document.createElement('span');
    name.innerHTML = `<span class="surah-name"></span><span class="surah-subtitle"></span>`;
    name.querySelector('.surah-name').textContent = surah.namaLatin;
    name.querySelector('.surah-subtitle').textContent = `${surah.jumlahAyat} ayat · ${surah.arti}`;
    const arabic = document.createElement('span');
    arabic.className = 'surah-arabic';
    arabic.lang = 'ar';
    arabic.dir = 'rtl';
    arabic.textContent = surah.nama;

    button.append(number, name, arabic);
    button.addEventListener('click', () => loadSurah(surah));
    elements.surahList.append(button);
  });
}

function setDetailStatus(message, isError = false) {
  elements.detail.hidden = true;
  elements.detailStatus.hidden = false;
  elements.detailStatus.className = isError ? 'error-message' : 'loading-line';
  elements.detailStatus.replaceChildren();

  if (!isError) {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');
    elements.detailStatus.append(spinner);
  }
  const text = document.createElement('span');
  text.textContent = message;
  elements.detailStatus.append(text);
}

function renderSurahDetail(surah) {
  elements.detail.replaceChildren();
  const header = document.createElement('header');
  header.className = 'detail-header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'detail-title-group';
  const number = document.createElement('span');
  number.className = 'detail-number';
  number.textContent = surah.nomor;
  const title = document.createElement('div');
  const heading = document.createElement('h2');
  heading.textContent = surah.namaLatin;
  const subtitle = document.createElement('p');
  subtitle.textContent = `${surah.arti} · ${surah.jumlahAyat} ayat · ${surah.tempatTurun}`;
  title.append(heading, subtitle);
  titleGroup.append(number, title);
  const arabicName = document.createElement('span');
  arabicName.className = 'detail-arabic-name';
  arabicName.lang = 'ar';
  arabicName.dir = 'rtl';
  arabicName.textContent = surah.nama;
  header.append(titleGroup, arabicName);

  const audioSources = Object.entries(surah.audioFull || {})
    .filter(([, url]) => typeof url === 'string' && url.startsWith('https://'));
  const audioSection = document.createElement('section');
  audioSection.className = 'surah-audio';
  const audioHeading = document.createElement('div');
  audioHeading.className = 'audio-heading';
  const audioTitle = document.createElement('h3');
  audioTitle.textContent = 'Dengarkan surat';
  const audioHint = document.createElement('span');
  audioHint.textContent = 'Pilih qari';
  audioHeading.append(audioTitle, audioHint);

  if (audioSources.length) {
    const audioControls = document.createElement('div');
    audioControls.className = 'audio-controls';
    const reciterLabel = document.createElement('label');
    reciterLabel.className = 'reciter-label';
    reciterLabel.textContent = 'Qari';
    const reciterSelect = document.createElement('select');
    reciterSelect.className = 'reciter-select';
    reciterSelect.setAttribute('aria-label', 'Pilih qari');
    audioSources.forEach(([key]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = `Qari ${key}`;
      reciterSelect.append(option);
    });
    reciterLabel.append(reciterSelect);

    const audioPlayer = document.createElement('audio');
    audioPlayer.className = 'audio-player';
    audioPlayer.controls = true;
    audioPlayer.preload = 'none';
    audioPlayer.setAttribute('aria-label', `Audio surat ${surah.namaLatin}`);
    const setAudioSource = () => {
      const selectedSource = audioSources.find(([key]) => key === reciterSelect.value);
      if (!selectedSource) return;
      audioPlayer.src = selectedSource[1];
      audioPlayer.load();
    };
    reciterSelect.addEventListener('change', setAudioSource);
    setAudioSource();
    audioControls.append(reciterLabel, audioPlayer);
    audioSection.append(audioHeading, audioControls);
  } else {
    audioHint.textContent = 'Audio tidak tersedia untuk surat ini.';
    audioSection.append(audioHeading);
  }

  const verseList = document.createElement('div');
  verseList.className = 'verse-list';
  surah.ayat.forEach((ayah) => {
    const verse = document.createElement('article');
    verse.className = 'verse';
    const verseNumber = document.createElement('span');
    verseNumber.className = 'verse-number';
    verseNumber.textContent = ayah.nomorAyat;
    const verseText = document.createElement('div');
    const arabic = document.createElement('p');
    arabic.className = 'verse-arabic';
    arabic.lang = 'ar';
    arabic.dir = 'rtl';
    arabic.textContent = ayah.teksArab;
    verseText.append(arabic);
    if (typeof ayah.teksIndonesia === 'string' && ayah.teksIndonesia.trim()) {
      const translation = document.createElement('p');
      translation.className = 'verse-translation';
      translation.textContent = ayah.teksIndonesia;
      verseText.append(translation);
    }
    verse.append(verseNumber, verseText);
    verseList.append(verse);
  });
  elements.detail.append(header, audioSection, verseList);
  elements.detail.hidden = false;
  elements.detailStatus.hidden = true;
}

async function loadSurah(surahSummary) {
  const requestId = ++state.surahRequestId;
  state.selectedSurah = { ...surahSummary, ayat: [] };
  renderSurahList(elements.surahSearch.value);
  updateMentorSurah();
  state.quiz = null;
  renderQuiz();
  setDetailStatus(`Memuat ${surahSummary.namaLatin}...`);

  try {
    const data = await fetchApi(`/surat/${surahSummary.nomor}`);
    if (requestId !== state.surahRequestId) return;
    if (!Array.isArray(data.ayat)) throw new Error('Data ayat tidak tersedia pada respons API.');
    state.selectedSurah = data;
    renderSurahList(elements.surahSearch.value);
    renderSurahDetail(data);
    updateMentorSurah();
    state.quiz = null;
    state.questionNumber = 0;
    renderQuiz();
  } catch (error) {
    if (requestId !== state.surahRequestId) return;
    setDetailStatus(`Tidak dapat memuat surat. ${error.message} Periksa koneksi, lalu pilih surat lagi.`, true);
    state.selectedSurah = null;
    renderSurahList(elements.surahSearch.value);
    updateMentorSurah();
    state.quiz = null;
    renderQuiz();
  }
}

function updateMentorSurah() {
  if (!state.selectedSurah?.ayat?.length) {
    elements.mentorSurahName.textContent = 'Belum dipilih';
    elements.mentorSurahMeta.textContent = 'Pilih surat di menu Al-Qur’an';
    return;
  }
  elements.mentorSurahName.textContent = state.selectedSurah.namaLatin;
  elements.mentorSurahMeta.textContent = `${state.selectedSurah.ayat.length} ayat · ${state.selectedSurah.arti}`;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function createQuestion(mode, surah) {
  const ayat = [...surah.ayat]
    .filter((ayah) => Number.isInteger(ayah.nomorAyat) && typeof ayah.teksArab === 'string' && ayah.teksArab.trim())
    .sort((first, second) => first.nomorAyat - second.nomorAyat);

  if (ayat.length < 4) {
    return { error: 'Surat ini memiliki kurang dari empat ayat. Pilih surat lain agar tiga pilihan jawaban dapat dibuat.' };
  }

  if (mode === 'guess') {
    const answer = randomItem(ayat);
    const distractors = shuffle(ayat.filter((ayah) => ayah.nomorAyat !== answer.nomorAyat)).slice(0, 2);
    const choices = shuffle([
      { value: String(answer.nomorAyat), correct: true },
      ...distractors.map((ayah) => ({ value: String(ayah.nomorAyat), correct: false }))
    ]);
    return { mode, prompt: answer, choices };
  }

  const prompts = ayat.slice(0, -1);
  const prompt = randomItem(prompts);
  const nextAyah = ayat.find((ayah) => ayah.nomorAyat === prompt.nomorAyat + 1);
  if (!nextAyah) return { error: 'Urutan ayat pada respons API tidak lengkap. Coba pilih surat lain.' };

  const wrongAyat = shuffle(ayat.filter((ayah) =>
    ayah.nomorAyat !== nextAyah.nomorAyat && ayah.teksArab !== nextAyah.teksArab
  ));
  const uniqueWrongAyat = [];
  const seenText = new Set([nextAyah.teksArab]);
  for (const ayah of wrongAyat) {
    if (!seenText.has(ayah.teksArab)) {
      uniqueWrongAyat.push(ayah);
      seenText.add(ayah.teksArab);
    }
    if (uniqueWrongAyat.length === 2) break;
  }
  if (uniqueWrongAyat.length < 2) {
    return { error: 'Tidak ada cukup teks ayat yang berbeda untuk tiga pilihan. Pilih surat lain.' };
  }

  const choices = shuffle([
    { value: nextAyah.teksArab, correct: true },
    ...uniqueWrongAyat.map((ayah) => ({ value: ayah.teksArab, correct: false }))
  ]);
  return { mode, prompt, choices };
}

function makePlaceholder(message) {
  const placeholder = document.createElement('div');
  placeholder.className = 'quiz-placeholder';
  const symbol = document.createElement('span');
  symbol.setAttribute('aria-hidden', 'true');
  symbol.textContent = '✳';
  const text = document.createElement('p');
  text.textContent = message;
  placeholder.append(symbol, text);
  return placeholder;
}

function answerQuestion(choiceIndex) {
  if (!state.quiz || state.quiz.answered) return;
  state.quiz.answered = true;
  const selectedChoice = state.quiz.choices[choiceIndex];
  if (selectedChoice.correct) state.score += 10;
  elements.score.textContent = state.score;
  elements.nextQuestion.disabled = false;

  const buttons = elements.quizContent.querySelectorAll('.option-button');
  buttons.forEach((button, index) => {
    button.disabled = true;
    if (state.quiz.choices[index].correct) button.classList.add('is-correct');
    else if (index === choiceIndex) button.classList.add('is-wrong');
  });

  const feedback = elements.quizContent.querySelector('.feedback');
  if (selectedChoice.correct) {
    feedback.textContent = 'Tepat! Skor bertambah 10 poin.';
  } else {
    feedback.textContent = `Belum tepat. Jawaban yang benar: ${selectedChoiceText(state.quiz.choices.findIndex((choice) => choice.correct), state.quiz.mode)}.`;
    feedback.classList.add('is-wrong');
  }
}

function selectedChoiceText(index, mode) {
  const choice = state.quiz.choices[index];
  return mode === 'guess' ? `ayat ${choice.value}` : choice.value;
}

function renderQuiz() {
  const isGuess = state.quizMode === 'guess';
  elements.quizModeLabel.textContent = isGuess ? 'TEBAK AYAT' : 'SAMBUNG AYAT';
  elements.nextQuestion.disabled = true;
  elements.questionNumber.textContent = String(Math.max(1, state.questionNumber)).padStart(2, '0');

  if (!state.selectedSurah?.ayat?.length) {
    elements.quizContent.replaceChildren(makePlaceholder('Pilih surat terlebih dahulu di menu Al-Qur’an untuk memulai latihan.'));
    return;
  }

  if (!state.quiz || state.quiz.mode !== state.quizMode) {
    state.quiz = createQuestion(state.quizMode, state.selectedSurah);
    if (!state.quiz.error) {
      state.questionNumber = Math.max(1, state.questionNumber);
      elements.questionNumber.textContent = String(state.questionNumber).padStart(2, '0');
    }
  }

  if (state.quiz.error) {
    elements.quizContent.replaceChildren(makePlaceholder(state.quiz.error));
    return;
  }

  elements.quizContent.replaceChildren();
  const question = document.createElement('div');
  question.className = 'quiz-question';
  const prompt = document.createElement('p');
  prompt.className = 'question-prompt';
  prompt.textContent = isGuess ? 'Ayat ini adalah ayat nomor berapa?' : 'Ayat apakah yang tepat sesudah ayat ini?';
  const surahLabel = document.createElement('span');
  surahLabel.className = 'question-surah';
  surahLabel.textContent = state.selectedSurah.namaLatin;
  const verse = document.createElement('p');
  verse.className = 'quiz-verse';
  verse.lang = 'ar';
  verse.dir = 'rtl';
  verse.textContent = state.quiz.prompt.teksArab;
  question.append(prompt, surahLabel, verse);

  const options = document.createElement('div');
  options.className = 'quiz-options';
  const feedback = document.createElement('p');
  feedback.className = 'feedback';
  feedback.setAttribute('role', 'status');
  state.quiz.choices.forEach((choice, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `option-button${isGuess ? '' : ' is-arabic'}`;
    const key = document.createElement('span');
    key.className = 'option-key';
    key.textContent = String.fromCharCode(65 + index);
    const label = document.createElement('span');
    label.className = 'option-label';
    label.textContent = isGuess ? `Ayat ${choice.value}` : choice.value;
    if (!isGuess) {
      label.lang = 'ar';
      label.dir = 'rtl';
    }
    button.append(key, label);
    button.addEventListener('click', () => answerQuestion(index));
    options.append(button);
  });
  elements.quizContent.append(question, options, feedback);
}

function startNextQuestion(resetScore = false) {
  if (resetScore) {
    state.score = 0;
    state.questionNumber = 0;
    elements.score.textContent = '0';
  } else if (state.quiz && !state.quiz.error) {
    state.questionNumber += 1;
  }
  state.quiz = null;
  renderQuiz();
}

async function loadSurahList() {
  elements.surahListStatus.textContent = 'Memuat daftar surat...';
  try {
    const data = await fetchApi('/surat');
    if (!Array.isArray(data)) throw new Error('Format daftar surat tidak sesuai.');
    state.surahs = data;
    elements.surahCount.textContent = data.length;
    elements.surahListStatus.textContent = `${data.length} surat tersedia`;
    renderSurahList();
  } catch (error) {
    elements.surahListStatus.textContent = `Gagal memuat daftar surat. ${error.message}`;
  }
}

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view));
});

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    state.quizMode = button.dataset.mode;
    state.quiz = null;
    state.questionNumber = 1;
    document.querySelectorAll('[data-mode]').forEach((modeButton) => {
      const isSelected = modeButton === button;
      modeButton.classList.toggle('is-selected', isSelected);
      modeButton.setAttribute('aria-pressed', String(isSelected));
    });
    renderQuiz();
  });
});

elements.surahSearch.addEventListener('input', () => renderSurahList(elements.surahSearch.value));
elements.nextQuestion.addEventListener('click', () => startNextQuestion());
elements.restartQuiz.addEventListener('click', () => startNextQuestion(true));

loadSurahList();