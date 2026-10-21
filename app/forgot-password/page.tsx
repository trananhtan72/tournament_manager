import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/app/forgot-password/ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
