import { redirect } from "next/navigation";

// /admin has no screen of its own yet; Users is the only admin section built.
export default function AdminIndexPage() {
  redirect("/admin/users");
}
