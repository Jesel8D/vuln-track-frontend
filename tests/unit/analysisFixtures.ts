import type { AnalysisRun, Finding, HistoryEvent } from "../../src/types/api";
export const assetId = "11111111-1111-4111-8111-111111111111";
export const runId = "22222222-2222-4222-8222-222222222222";
export const findingId = "33333333-3333-4333-8333-333333333333";
export const userId = "44444444-4444-4444-8444-444444444444";
export const identId = "55555555-5555-4555-8555-555555555555";
export const timestamp = "2026-11-09T05:00:00Z";
export const cpe =
  "cpe:2.3:o:cisco:small_business_rv340_firmware:1.0.0.33:*:*:*:*:*:*:*";
export const run: AnalysisRun = {
  id: runId,
  asset_id: assetId,
  identification_id: identId,
  initiated_by: userId,
  selected_cpe: cpe,
  observed_version: "1.0.0.33",
  status: "completed",
  coverage: "complete",
  created_at: timestamp,
  started_at: timestamp,
  completed_at: timestamp,
  source_timestamp: timestamp,
  total_results: 1,
  retrieved_count: 1,
  stored_count: 1,
  page_count: 1,
  next_index: 1,
  retry_count: 0,
  query_parameters: { cpeName: cpe },
  warning_codes: [],
  source_timestamps: [timestamp],
  page_manifest: [],
  failure_code: null,
  nvd_cooldown_until: null,
};
export const finding: Finding = {
  id: findingId,
  analysis_id: runId,
  external_id: "CVE-2017-6784",
  source: "NVD",
  title: "Controlled test description",
  applicability: "undetermined",
  status: "open",
  cvss: {
    cvssMetricV31: [
      {
        source: "nvd@nist.gov",
        type: "Primary",
        cvssData: {
          version: "3.1",
          baseScore: 5.3,
          baseSeverity: "MEDIUM",
          vectorString: "CVSS:3.1/AV:N",
        },
      },
    ],
  },
  evidence: {
    initial_applicability: "undetermined",
    rule_codes: ["COMPLEX_CONFIGURATION"],
    configurations: [{ operator: "AND" }],
    descriptions: [{ lang: "en", value: "<script>untrusted</script>" }],
    vulnStatus: "Modified",
    truncated: false,
  },
  observed_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
  reviewed_by: null,
  reviewed_at: null,
  review_reason: null,
  review_evidence: null,
};
export const identification: HistoryEvent = {
  id: identId,
  asset_id: assetId,
  state: "confirmed",
  cpe_name_id: identId,
  cpe_name: cpe,
  component_kind: "firmware",
  observed_version: "1.0.0.33",
  source: "NVD",
  validated_at: timestamp,
  recorded_by: userId,
  recorded_at: timestamp,
  reason: "Observed",
  replaces_id: null,
  valid_to: null,
  is_current: true,
};
