import { redirect } from "next/navigation";

/**
 * Drivers, buyers, and admins now share /login. This route stays so
 * older bookmarks / printed links keep working — it just forwards on.
 */
export default function DriverLoginRedirect() {
  redirect("/login");
}
