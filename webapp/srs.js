// SM-2 lite spaced repetition.
// Card: { word, easiness, interval, repetitions, dueDate (ISO), data: {...} }
const SRS = (() => {
  const DAY = 86400000;

  const today = () => new Date().toISOString().slice(0, 10);
  const todayMs = () => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
  };

  const newCard = (word, data = {}) => ({
    word,
    easiness: 2.5,
    interval: 0,
    repetitions: 0,
    dueDate: today(),
    data,
  });

  // quality: 0..5 (Hard=2, OK=4, Easy=5)
  const review = (card, quality) => {
    if (quality < 3) {
      card.repetitions = 0;
      card.interval = 1;
    } else {
      card.repetitions += 1;
      if (card.repetitions === 1) card.interval = 1;
      else if (card.repetitions === 2) card.interval = 3;
      else card.interval = Math.round(card.interval * card.easiness);
    }
    const ef = card.easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    card.easiness = Math.max(1.3, ef);
    const due = new Date(todayMs() + card.interval * DAY);
    card.dueDate = due.toISOString().slice(0, 10);
    return card;
  };

  const isDue = (card) => card.dueDate <= today();

  const dueCards = (deck) => Object.values(deck).filter(isDue)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const dueCount = (deck) => dueCards(deck).length;

  return { newCard, review, isDue, dueCards, dueCount, today };
})();
