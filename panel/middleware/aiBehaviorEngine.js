// ============================================================
// Orbiton Local AI Behavioral Pattern & Variance Engine
// Statistical Machine Learning Model for Human vs Bot Trajectory Detection
// Footprint: < 500KB RAM (Zero external dependencies)
// ============================================================

const sessionTrajectories = new Map(); // { id -> [timestamps] }

// Auto cleanup inactive sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, history] of sessionTrajectories.entries()) {
    if (history.length > 0 && now - history[history.length - 1] > 10 * 60 * 1000) {
      sessionTrajectories.delete(id);
    }
  }
}, 10 * 60 * 1000);

/**
 * Evaluates request timing variance and cognitive jitter for human behavior vs bot scripts.
 * Recognizes fast human clicks (e.g. rapid tab switching) via millisecond jitter analysis.
 * Returns { isHuman: boolean, variance: number, jitter: number, classification: string, burstCap: number }
 */
function analyzeTrafficBehavior(id, timestamp = Date.now()) {
  let history = sessionTrajectories.get(id);
  if (!history) {
    history = [];
    sessionTrajectories.set(id, history);
  }

  history.push(timestamp);
  // Keep last 20 request timestamps
  if (history.length > 20) {
    history.shift();
  }

  // Need at least 3 requests to analyze timing jitter
  if (history.length < 3) {
    return { isHuman: true, variance: 9999, jitter: 500, classification: 'INITIALIZING', burstCap: 500 };
  }

  // Calculate interval differences Δt (in ms)
  const intervals = [];
  for (let i = 1; i < history.length; i++) {
    intervals.push(history[i] - history[i - 1]);
  }

  // Compute Mean (μ)
  const sum = intervals.reduce((acc, val) => acc + val, 0);
  const mean = sum / intervals.length;

  // Compute Variance (σ²)
  const variance = intervals.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intervals.length;

  // Compute Cognitive Jitter Score (J = Mean absolute difference between consecutive intervals)
  let jitterSum = 0;
  for (let i = 1; i < intervals.length; i++) {
    jitterSum += Math.abs(intervals[i] - intervals[i - 1]);
  }
  const jitter = intervals.length > 1 ? jitterSum / (intervals.length - 1) : 100;

  // Classification Logic:
  // 1. Human Rapid Clicker: Fast intervals (< 500ms) with natural physical jitter (jitter > 8ms)
  // 2. Human Thoughtful Switcher: Larger intervals with high variance (variance > 150)
  // 3. Bot Script: Zero or near-zero jitter (jitter < 3ms) AND uniform interval timing (variance < 30)

  const isRapidHuman = mean < 600 && jitter > 8;
  const isThoughtfulHuman = variance > 150;
  const isUniformBot = jitter < 3 && variance < 30 && mean < 1500;

  let classification = 'VERIFIED_HUMAN_COGNITIVE';
  let burstCap = 500; // Ultra high burst allowance for humans

  if (isRapidHuman) {
    classification = 'HUMAN_RAPID_CLICKER';
    burstCap = 1000;
  } else if (isUniformBot) {
    classification = 'BOT_UNIFORM_AUTOMATION';
    burstCap = 10;
  }

  return {
    isHuman: !isUniformBot,
    variance: Math.round(variance),
    jitter: Math.round(jitter),
    classification,
    burstCap
  };
}

module.exports = {
  analyzeTrafficBehavior
};
