const paths: Record<string, string> = {
  your_people:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  memory_lane: "M3 11a9 9 0 1 1 2.7 7M3 4v7h7M12 7v5l3 2",
  reconnect:
    "M8 3 4 7l4 4M4 7h11a5 5 0 0 1 5 5M16 21l4-4-4-4M20 17H9a5 5 0 0 1-5-5",
  unfinished_plans:
    "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM9 16h6",
  unanswered:
    "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6A8.4 8.4 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8v.5ZM9 10h6M9 14h3",
  both_wanted: "M9 8a5 5 0 1 1 0 8 5 5 0 1 1 0-8ZM15 8a5 5 0 1 1 0 8",
  recap:
    "M4 3h6a3 3 0 0 1 3 3v15a4 4 0 0 0-4-2H3V3h1ZM13 6a3 3 0 0 1 3-3h5v16h-5a4 4 0 0 0-3 2",
};

export function CardIcon({
  kind,
  className = "h-4 w-4",
}: {
  kind: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path
        d={
          Object.hasOwn(paths, kind)
            ? paths[kind]
            : "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"
        }
      />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  );
}
