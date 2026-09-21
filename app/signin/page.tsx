import { SignInForm } from "@/app/signin/SignInForm";

export default async function SignInPage({
  searchParams,
}: PageProps<"/signin">) {
  const params = await searchParams;
  const sessionExpired = params.sessionExpired === "1";

  return <SignInForm sessionExpired={sessionExpired} />;
}
