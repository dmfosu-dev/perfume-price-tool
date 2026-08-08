import { redirect } from "next/navigation";
import { getCurrentUser, landingPathFor } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? landingPathFor(user) : "/login");
}
