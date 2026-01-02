import pdf from "pdf-parse";
import mammoth from "mammoth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { processDocument } from "./embeddingPipeline";

export interface DocumentMetadata {
  fileName: string;
  fileType: string;
  fileSize: number;
  extractedText: string;
  pageCount?: number;
}

export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<DocumentMetadata> {
  let extractedText = "";
  let pageCount: number | undefined;

  try {
    if (mimeType === "application/pdf") {
      // Parse PDF
      const data = await pdf(buffer);
      extractedText = data.text;
      pageCount = data.numpages;
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword"
    ) {
      // Parse DOCX
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (mimeType === "text/plain" || mimeType === "text/markdown") {
      // Parse TXT/MD
      extractedText = buffer.toString("utf-8");
    } else {
      throw new Error("Unsupported document type");
    }

    return {
      fileName,
      fileType: mimeType,
      fileSize: buffer.length,
      extractedText,
      pageCount,
    };
  } catch (error) {
    console.error("Document parsing error:", error);
    throw new Error("Failed to parse document");
  }
}

export async function analyzeDocument(
  extractedText: string,
  fileName: string
): Promise<{
  summary: string;
  category: string;
  keyInfo: Record<string, any>;
}> {
  try {
    // Determine document category based on content
    const category = categorizeDocument(extractedText, fileName);
    
    // Extract key information based on category
    const keyInfo = extractKeyInformation(extractedText, category);
    
    // Generate summary (first 500 characters or key points)
    const summary = extractedText.slice(0, 500) + (extractedText.length > 500 ? "..." : "");

    return {
      summary,
      category,
      keyInfo,
    };
  } catch (error) {
    console.error("Document analysis error:", error);
    throw new Error("Failed to analyze document");
  }
}

function categorizeDocument(text: string, fileName: string): string {
  const lowerText = text.toLowerCase();
  const lowerFileName = fileName.toLowerCase();

  if (
    lowerFileName.includes("syllabus") ||
    lowerText.includes("course outline") ||
    lowerText.includes("course description")
  ) {
    return "academic";
  }

  if (
    lowerFileName.includes("transcript") ||
    lowerText.includes("grade point average") ||
    lowerText.includes("gpa")
  ) {
    return "academic";
  }

  if (
    lowerFileName.includes("resume") ||
    lowerFileName.includes("cv") ||
    lowerText.includes("work experience") ||
    lowerText.includes("education")
  ) {
    return "career";
  }

  if (
    lowerFileName.includes("assignment") ||
    lowerText.includes("due date") ||
    lowerText.includes("submission")
  ) {
    return "academic";
  }

  return "general";
}

function extractKeyInformation(
  text: string,
  category: string
): Record<string, any> {
  const keyInfo: Record<string, any> = {};

  switch (category) {
    case "syllabus":
      // Extract course code, instructor, deadlines
      const courseCodeMatch = text.match(/[A-Z]{2,4}\s?\d{3,4}/i);
      if (courseCodeMatch) {
        keyInfo.courseCode = courseCodeMatch[0];
      }
      
      const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        keyInfo.instructorEmail = emailMatch[0];
      }
      break;

    case "transcript":
      // Extract GPA
      const gpaMatch = text.match(/GPA[:\s]+(\d\.\d{1,2})/i);
      if (gpaMatch) {
        keyInfo.gpa = parseFloat(gpaMatch[1]);
      }
      break;

    case "resume":
      // Extract skills, education
      const skillsMatch = text.match(/skills?[:\s]+([^\n]+)/i);
      if (skillsMatch) {
        keyInfo.skills = skillsMatch[1].split(",").map((s) => s.trim());
      }
      break;

    case "assignment":
      // Extract due date
      const dueDateMatch = text.match(/due[:\s]+([^\n]+)/i);
      if (dueDateMatch) {
        keyInfo.dueDate = dueDateMatch[1].trim();
      }
      break;
  }

  return keyInfo;
}

export async function uploadToStorage(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  userId: string
): Promise<{ filePath: string; publicUrl: string }> {
  const supabase = createServiceRoleClient();

  const filePath = `${userId}/documents/${Date.now()}-${fileName}`;

  const { error } = await supabase.storage
    .from("documents")
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload to storage: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from("documents")
    .getPublicUrl(filePath);

  return { filePath, publicUrl: urlData.publicUrl };
}

/**
 * Process document through embedding pipeline
 * Called after document upload and parsing
 */
export async function processDocumentEmbeddings(
  documentId: string,
  buffer: Buffer,
  extractedText: string | null,
  userId: string,
  fileName: string,
  mimeType: string,
  category?: string
): Promise<void> {
  try {
    // Determine if document is image or text
    const isImage = mimeType.startsWith("image/");

    if (isImage) {
      // Process image through embedding pipeline
      await processDocument(
        documentId,
        buffer,
        userId,
        fileName,
        mimeType,
        category
      );
    } else if (extractedText) {
      // Process text document through embedding pipeline
      await processDocument(
        documentId,
        extractedText,
        userId,
        fileName,
        mimeType,
        category
      );
    } else {
      throw new Error("No content available for embedding");
    }
  } catch (error) {
    console.error(`Error processing embeddings for ${documentId}:`, error);
    throw error;
  }
}
