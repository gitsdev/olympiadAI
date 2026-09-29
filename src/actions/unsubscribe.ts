"use server";

import { redirect } from "next/navigation";
import { optOutByToken } from "@/lib/email/unsubscribe";

export async function confirmUnsubscribe(formData: FormData) {
  const ok = await optOutByToken(formData.get("token")?.toString());
  redirect(ok ? "/unsubscribe?done=1" : "/unsubscribe?invalid=1");
}
