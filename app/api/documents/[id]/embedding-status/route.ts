import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { getEmbeddingProgress } from "@/lib/documents/embeddingPipeline";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await getAuthenticatedUser();
    if (error || !user) {
      return unauthorizedResponse();
    }

    const { id: documentId } = await params;

    // Get embedding progress
    const progress = await getEmbeddingProgress(documentId);

    if (!progress) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      progress,
    });
  } catch (error: any) {
    console.error("Error getting embedding progress:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get embedding progress" },
      { status: 500 }
    );
  }
}
