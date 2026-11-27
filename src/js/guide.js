import { stages } from "./data.js";
import { fmtExact } from "./numbers.js";
import { chapterIndex, guideGoal, nextCoinUnlocks } from "./progression.js";
import { s } from "./state.js";
import { $, setText } from "./ui-dom.js";

function progressionGuideMarkup() {
  return `<section class="up-card guide-chapter" aria-labelledby="guideChapter">
      <h3 id="guideChapter"></h3>
    </section>
    <section class="guide-upcoming" aria-labelledby="guideNextTitle">
      <h3 id="guideNextTitle">Next unlocks</h3>
      <div id="guideNext"></div>
    </section>`;
}

function guideCoinCard(tier, progressId) {
  const title = tier.unlocks.map(({ name }) => name).join(" + ");
  const description = tier.unlocks
    .map(({ description }) => description)
    .join(" ");
  return `<article class="up-card guide-entry" data-guide-tier="${tier.target}">
    <h3>${title}</h3><p>${description}</p><p id="${progressId}"></p>
  </article>`;
}

function guideProgress(state, target) {
  return (
    fmtExact(Math.floor(state.total)) +
    " / " +
    fmtExact(target) +
    " coins earned this run"
  );
}

function updateProgressionGuide() {
  const chapter = chapterIndex(s);
  setText(
    $("guideChapter"),
    "Chapter " +
      String(chapter + 1).padStart(2, "0") +
      " · " +
      stages[chapter].title,
  );
  const [firstTier, secondTier] = nextCoinUnlocks(s);
  const goal = guideGoal(s);
  const next = $("guideNext");
  const key =
    (firstTier?.target ?? "") +
    ":" +
    (goal ? "goal" : (secondTier?.target ?? ""));
  if (next.dataset.target !== key) {
    const primary = firstTier ? guideCoinCard(firstTier, "guideEarned") : "";
    const secondary = goal
      ? `<article class="up-card guide-entry"><h3>From the field</h3><p id="guideGoal"></p></article>`
      : secondTier
        ? guideCoinCard(secondTier, "guideNextEarned")
        : "";
    next.dataset.target = key;
    next.innerHTML =
      primary + secondary ||
      '<p class="subtext">Every field is unlocked in this run.</p>';
  }
  if (firstTier) setText($("guideEarned"), guideProgress(s, firstTier.target));
  if (goal) setText($("guideGoal"), goal);
  else if (secondTier)
    setText($("guideNextEarned"), guideProgress(s, secondTier.target));
}

export { progressionGuideMarkup, updateProgressionGuide };
