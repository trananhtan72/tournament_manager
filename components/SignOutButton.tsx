import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/Button";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="secondary" className="px-3 py-1.5">
        Sign out
      </Button>
    </form>
  );
}
