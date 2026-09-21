import { SignInForm } from "@/app/signin/SignInForm";
import { safeCallbackUrl } from "@/lib/callbackUrl";

export default async function SignInPage({
  searchParams,
}: PageProps<"/signin">) {
  const params = await searchParams;
  const sessionExpired = params.sessionExpired === "1";
  const callbackUrl = safeCallbackUrl(params.callbackUrl, "/organizer");

  return <SignInForm sessionExpired={sessionExpired} callbackUrl={callbackUrl} />;
}
