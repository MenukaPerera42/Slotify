import { redirect } from "next/navigation";

// Keep bookmarked verification links safe until the frontend removes them.
export default function VerifyEmailPage() {
  redirect("/login");
}
