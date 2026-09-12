import { ResetPasswordPage } from "@/modules/auth/pages/ResetPasswordPage";

export default async function ResetPasswordRoutePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ResetPasswordPage token={token} />;
}
