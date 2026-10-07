import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaskStore } from "./run-task";

/** TaskStore backed by seo_agent_tasks / seo_ai_usage. */
export function supabaseTaskStore(db: SupabaseClient): TaskStore {
  return {
    async createTask(task) {
      const { data, error } = await db.from("seo_agent_tasks").insert(task).select("id").single();
      if (error || !data) throw new Error(`Could not create agent task: ${error?.message ?? "no row returned"}`);
      return (data as { id: string }).id;
    },
    async finishTask(id, patch) {
      const { error } = await db.from("seo_agent_tasks").update(patch).eq("id", id);
      if (error) throw new Error(`Could not update agent task ${id}: ${error.message}`);
    },
    async recordUsage(usage) {
      const { error } = await db.from("seo_ai_usage").insert(usage);
      if (error) throw new Error(`Could not record AI usage: ${error.message}`);
    },
  };
}
