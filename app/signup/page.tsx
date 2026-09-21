import { SignUpForm } from "@/app/signup/SignUpForm";
import { safeCallbackUrl } from "@/lib/callbackUrl";

export default async function SignUpPage({
  searchParams,
}: PageProps<"/signup">) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl, "/organizer");

  return <SignUpForm callbackUrl={callbackUrl} />;
}
