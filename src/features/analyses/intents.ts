import type { AnalysisInput } from "../../types/api";
export interface AnalysisIntent {
  key: string;
  body: AnalysisInput;
  uncertain: boolean;
}
// Session memory only, retained across route changes, cleared on logout/expiry.
class AnalysisIntents {
  private requests = new Map<string, AnalysisIntent>();
  get(user: string, asset: string) {
    return this.requests.get(`${user}:${asset}`) ?? null;
  }
  set(user: string, asset: string, intent: AnalysisIntent) {
    this.requests.set(`${user}:${asset}`, intent);
  }
  remove(user: string, asset: string) {
    this.requests.delete(`${user}:${asset}`);
  }
  clear() {
    this.requests.clear();
  }
}
export const analysisIntents = new AnalysisIntents();
