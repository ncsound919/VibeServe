import type { RawSuggestion, Suggestion, GoalSummary, SuggestionType } from '../types/suggestions';

const GOAL_TYPE_TO_SUGGESTION_TYPE: Record<string, SuggestionType> = {
  feature: 'refactor',
  reliability: 'fix',
  performance: 'perf',
  docs: 'docs',
  chore: 'chore',
  marketing: 'docs',
};

export function bindSuggestionsToGoals(
  suggestions: RawSuggestion[],
  activeGoals: GoalSummary[]
): Suggestion[] {
  if (!activeGoals.length) {
    return suggestions.map(s => ({
      ...s,
      goalId: null,
    }));
  }

  return suggestions.map(suggestion => {
    const bestGoal = pickBestGoalForSuggestion(suggestion, activeGoals);

    if (!bestGoal) {
      return {
        ...suggestion,
        goalId: null,
      };
    }

    return {
      ...suggestion,
      goalId: bestGoal.id,
      goalTitle: bestGoal.title,
      goalPriority: bestGoal.priority,
    };
  });
}

function pickBestGoalForSuggestion(
  suggestion: RawSuggestion,
  activeGoals: GoalSummary[]
): GoalSummary | null {
  const areaMatched = activeGoals.filter(g =>
    g.areas?.length && suggestion.filePath &&
    g.areas.some(area => suggestion.filePath!.startsWith(area))
  );

  const candidates = areaMatched.length ? areaMatched : activeGoals;

  const text = `${suggestion.title} ${suggestion.description}`.toLowerCase();

  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  const scored = candidates.map(goal => {
    let score = 0;

    if (goal.tags?.length) {
      for (const tag of goal.tags) {
        if (text.includes(tag.toLowerCase())) {
          score += 1;
        }
      }
    }

    if (goal.goalType) {
      const targetType = GOAL_TYPE_TO_SUGGESTION_TYPE[goal.goalType];
      if (targetType && suggestion.type === targetType) {
        score += 2;
      }
    }

    if (goal.areas?.length && suggestion.filePath) {
      for (const area of goal.areas) {
        if (suggestion.filePath.startsWith(area)) {
          score += 3;
          break;
        }
      }
    }

    if (goal.dueDate) {
      const due = new Date(goal.dueDate).getTime();
      if (!isNaN(due) && due > now && (due - now) < SEVEN_DAYS) {
        score += 1;
      }
      if (!isNaN(due) && due < now) {
        score += 2;
      }
    }

    const priorityBoost = goal.priority ? (6 - goal.priority) : 0;
    score += priorityBoost;

    return { goal, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score <= 0) {
    return null;
  }

  return best.goal;
}
