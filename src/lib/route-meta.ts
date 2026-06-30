export interface RouteMeta {
  title: string;
  subtitle?: string;
  /** If true, the content area will not scroll (screen manages its own layout) */
  noScroll?: boolean;
}

export const ROUTE_META: Record<string, RouteMeta> = {
  "/dashboard":    { title: "Home",           subtitle: "Let's get a session in" },
  "/tutor":        { title: "AI Tutor",        subtitle: "Grounded in your knowledge graph", noScroll: true },
  "/practice":     { title: "Practice",        subtitle: "Adaptive · Number System" },
  "/results":      { title: "Your results",    subtitle: "Number System · adaptive test" },
  "/learn":        { title: "Learning paths",  subtitle: "Your curriculum knowledge graph" },
  "/tests":        { title: "Mock tests",      subtitle: "Take one, or build your own" },
  "/achievements": { title: "Achievements",    subtitle: "Points, badges & your batch leaderboard" },
  "/settings":     { title: "Settings",        subtitle: "Account & preferences" },
};
