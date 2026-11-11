interface AnalysisIntent {
  requestKey: string | null;
  runId: string | null;
}

const intents = new Map<string, AnalysisIntent>();

export const v2AnalysisIntents = {
  get(scope: string): AnalysisIntent {
    return intents.get(scope) ?? { requestKey: null, runId: null };
  },
  setRequest(scope: string, requestKey: string) {
    intents.set(scope, { requestKey, runId: null });
  },
  setRun(scope: string, runId: string) {
    intents.set(scope, { requestKey: null, runId });
  },
  clear(scope: string) {
    intents.delete(scope);
  },
  clearAll() {
    intents.clear();
  },
};
