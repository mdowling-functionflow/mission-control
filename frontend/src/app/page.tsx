"use client";

/**
 * Root page redirects to the Overview (founder homepage).
 * The actual overview content lives at /dashboard but this redirect
 * ensures / always lands at the right place after auth.
 */

import { redirect } from "next/navigation";

export default function Page() {
  redirect("/agent/main");
}
