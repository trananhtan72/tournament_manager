import { SignInForm } from "@/app/signin/SignInForm";
import { safeCallbackUrl } from "@/lib/callbackUrl";
import { isGoogleAuthEnabled } from "@/lib/googleAuthEnabled";

export default async function SignInPage({
  searchParams,
}: PageProps<"/signin">) {
  const params = await searchParams;
  const sessionExpired = params.sessionExpired === "1";
  const passwordReset = params.passwordReset === "1";
  const callbackUrl = safeCallbackUrl(params.callbackUrl, "/organizer");

  return (
    <SignInForm
      sessionExpired={sessionExpired}
      passwordReset={passwordReset}
      callbackUrl={callbackUrl}
      googleEnabled={isGoogleAuthEnabled()}
    />
  );
}
