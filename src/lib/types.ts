import type { Evidence, Tie } from "./signals";
import type { Closeness, Factor } from "./closeness";

export type { Evidence, Tie, Closeness, Factor };

export type CloseView = Closeness & { headline: string };

export type TieView = Tie & { headline: string };

export type Report = {
  session: string;
  owner: string;
  threadCount: number;
  messageCount: number;
  ties: TieView[];
  closest: CloseView[];
  sample?: boolean;
  search?: { enabled: boolean; indexed: number; error: string | null };
};

export const KIND_LABEL: Record<Evidence["kind"], string> = {
  "open-loop": "Unanswered",
  promise: "Never happened",
  want: "They wanted",
  milestone: "Went unremarked",
};
