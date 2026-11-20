import { NextResponse } from "next/server";
import { getAppUrl, getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL("/", getAppUrl()));
}
