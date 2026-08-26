// services/post-service/src/ml/signalMapper.js
//
// Converts the ML Brain's raw `risk_flag` ("green" | "yellow" | "red")
// into a user-friendly { signal, message } pair for the frontend.
//
// NOTE: risk_engine.py (ML Brain) currently only ever returns green,
// yellow, or red — there is no "orange" tier in the real pipeline yet.
// If a 4th tier is added later, extend both risk_engine.py's
// calculate_risk() AND the switch below together, or the two will drift.

export function getAISignal(riskFlag) {
  switch (riskFlag) {
    case 'green':
      return {
        signal: 'Positive',
        message: 'This post can make your day.',
      };

    case 'yellow':
      return {
        signal: 'Neutral',
        message: 'Think twice before reacting.',
      };

    case 'red':
      return {
        signal: 'High Risk',
        message: 'You may want to avoid this discussion.',
      };

    default:
      // Covers null/undefined riskFlag — e.g. post has no text yet,
      // or ML analysis hasn't completed.
      return {
        signal: 'Analyzing',
        message: 'VerbaScope AI is analyzing this post...',
      };
  }
}