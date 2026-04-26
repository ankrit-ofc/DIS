import { SignInCard2 } from "@/components/ui/sign-in-card-2";

export const metadata = {
  title: "Sign in (preview) · DISTRO",
  description: "Alternate glass sign-in card preview — compare with /login",
};

/** Full-page preview of the sign-in card; main app login remains at /login */
export default function LoginAltPage() {
  return <SignInCard2 />;
}
