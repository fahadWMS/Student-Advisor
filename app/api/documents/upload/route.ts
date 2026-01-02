import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { parseDocument, analyzeDocument, uploadToStorage, processDocumentEmbeddings } from "@/lib/documents/documentService";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getAuthenticatedUser();
    if (error || !user) {
      return unauthorizedResponse();
    }

    // Get file from form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 20MB limit" }, { status: 400 });
    }

    // Validate file type
    const supportedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "text/markdown",
    ];

    if (!supportedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, DOCX, TXT, or MD" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse document
    const metadata = await parseDocument(buffer, file.type, file.name);

    // Analyze document
    const analysis = await analyzeDocument(metadata.extractedText, file.name);

    // Upload to Supabase Storage
    const { filePath, publicUrl } = await uploadToStorage(buffer, file.name, file.type, user.id);

    // Save to database
    const document = await prisma.document.create({
      data: {
        userId: user.id,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        storagePath: filePath,
        processedContent: metadata.extractedText,
        category: analysis.category,
        tags: Object.keys(analysis.keyInfo),
        vectorized: false, // Will be updated by background process
      },
    });

    // Process embeddings asynchronously (don't block response)
    // Note: In production, use a background job queue (e.g., BullMQ, Inngest)
    // For now, we'll use a fire-and-forget promise
    processDocumentEmbeddings(
      document.id,
      buffer,
      metadata.extractedText,
      user.id,
      file.name,
      file.type,
      analysis.category
    ).catch((error) => {
      console.error(`Background embedding failed for ${document.id}:`, error);
    });

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        fileName: document.fileName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        storageUrl: publicUrl,
        category: document.category,
        uploadedAt: document.createdAt,
        vectorized: false, // Will be updated asynchronously
        embeddingStatus: "processing", // Status indicator
      },
      analysis: {
        summary: analysis.summary,
        keyInfo: analysis.keyInfo,
      },
    });
  } catch (error: any) {
    console.error("Document upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload document" },
      { status: 500 }
    );
  }
}
