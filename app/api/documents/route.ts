import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const buildPublicUrl = (storagePath: string) => {
  if (!storagePath) return "";
  if (storagePath.startsWith("http")) {
    return storagePath;
  }
  if (!SUPABASE_URL) {
    return storagePath;
  }
  return `${SUPABASE_URL}/storage/v1/object/public/documents/${storagePath}`;
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Check authentication
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    // Build query
    const where: any = { userId: session.user.id };
    
    if (category && category !== "all") {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { fileName: { contains: search, mode: "insensitive" } },
        { processedContent: { contains: search, mode: "insensitive" } },
      ];
    }

    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        storagePath: true,
        category: true,
        tags: true,
        vectorized: true,
        chunkCount: true,
        embeddingError: true,
        createdAt: true,
      },
    });

    const withUrls = documents.map((doc) => ({
      ...doc,
      storageUrl: buildPublicUrl(doc.storagePath),
      embeddingStatus: doc.vectorized 
        ? "completed" 
        : doc.embeddingError 
          ? "failed" 
          : "processing",
    }));

    return NextResponse.json({ documents: withUrls });
  } catch (error: any) {
    console.error("Get documents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
