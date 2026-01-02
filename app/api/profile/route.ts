import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  studentId: z.string().trim().max(50).optional(),
  department: z.string().trim().max(120).optional(),
  major: z.string().trim().max(120).optional(),
  year: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === "") {
        return null;
      }
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    }, z.number().int().min(1).max(10).nullable())
    .optional(),
  bio: z.string().trim().max(500).optional(),
});

export async function GET() {
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) {
    return unauthorizedResponse();
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      studentId: true,
      department: true,
      year: true,
      major: true,
      bio: true,
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: dbUser });
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const parsed = profileSchema.parse(body);

    const data: Record<string, unknown> = {};
    if (parsed.name !== undefined) data.name = parsed.name;
    if (parsed.studentId !== undefined) data.studentId = parsed.studentId || null;
    if (parsed.department !== undefined) data.department = parsed.department || null;
    if (parsed.major !== undefined) data.major = parsed.major || null;
    if (parsed.bio !== undefined) data.bio = parsed.bio || null;
    if (parsed.year !== undefined) data.year = parsed.year;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields provided" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        studentId: true,
        department: true,
        year: true,
        major: true,
        bio: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (err) {
    console.error("Failed to update profile", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
