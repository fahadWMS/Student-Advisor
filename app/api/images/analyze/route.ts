import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { analyzeImage } from "@/lib/ai/imageAnalysisService";
import sharp from "sharp";

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getAuthenticatedUser();
    if (error || !user) {
      return unauthorizedResponse();
    }

    const formData = await request.formData();
    const imageFile = formData.get("image") as File;
    const userPrompt = formData.get("prompt") as string | null;

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Image size exceeds 10MB limit" }, { status: 400 });
    }

    // Validate image type
    const supportedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!supportedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: "Unsupported image type. Use JPEG, PNG, or WebP" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);
    let buffer: Buffer;

    // Optimize/compress image if needed
    if (originalBuffer.length > 1 * 1024 * 1024) {
      // Compress images larger than 1MB
      buffer = await sharp(originalBuffer)
        .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } else {
      buffer = originalBuffer;
    }

    // Convert to base64
    const base64Image = buffer.toString("base64");

    // Analyze image
    const analysis = await analyzeImage(base64Image, imageFile.type, userPrompt || undefined);

    // Upload to Supabase Storage
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const fileName = `${user.id}/images/${Date.now()}-${imageFile.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("images")
      .upload(fileName, buffer, {
        contentType: imageFile.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
    }

    const { data: urlData } = supabase.storage.from("images").getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      imageUrl: urlData.publicUrl,
      analysis: {
        description: analysis.description,
        extractedText: analysis.extractedText,
        keyElements: analysis.keyElements,
        educationalContext: analysis.educationalContext,
      },
    });
  } catch (error: any) {
    console.error("Image analysis API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze image" },
      { status: 500 }
    );
  }
}
