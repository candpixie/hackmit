import type { Evidence, Tie } from "./signals";

export type { Evidence, Tie };

export type TieView = Tie & { headline: string };

export type Report = {
  session: string;
  owner: string;
  threadCount: number;
  messageCount: number;
  ties: TieView[];
  sample?: boolean;
  search?: { enabled: boolean; indexed: number; error: string | null };
};

export const KIND_LABEL: Record<Evidence["kind"], string> = {
  "open-loop": "Unanswered",
  promise: "Never happened",
  want: "They wanted",
  milestone: "Went unremarked",
};
