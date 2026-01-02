import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return { user: null, error: "Unauthorized" };
  }
  
  return { user: session.user, error: null };
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
