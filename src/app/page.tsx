import { redirect } from "next/navigation";
import { Landing } from "@/components/landing/Landing";
import { getSession, isGoogleConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();

  if (session.refreshToken && session.user) {
    redirect("/app");
  }

  const { error } = await searchParams;
  return <Landing configured={isGoogleConfigured()} error={error} />;
}
