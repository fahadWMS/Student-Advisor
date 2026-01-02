import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service";

const BUCKET = "documents";

const extractStoragePath = (value: string | null) => {
  if (!value) return null;
  if (!value.startsWith("http")) {
    return value;
  }

  const marker = `/${BUCKET}/`;
  const markerIndex = value.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  return value.substring(markerIndex + marker.length);
};

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) {
    return unauthorizedResponse();
  }

  const document = await prisma.document.findFirst({
    where: { id: documentId, userId: user.id },
    select: { id: true, storagePath: true },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const supabase = createServiceRoleClient();
  const path = extractStoragePath(document.storagePath);

  if (path) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([path]);
    if (storageError) {
      console.error("Failed to delete file from storage", storageError);
    }
  }

  await prisma.document.delete({ where: { id: document.id } });

  return NextResponse.json({ success: true });
}
