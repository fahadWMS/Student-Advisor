"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, File, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentUploadProps {
  onUploadComplete: (document: any) => void;
  className?: string;
}

export function DocumentUpload({ onUploadComplete, className }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    setFiles(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
    },
    maxSize: 20 * 1024 * 1024, // 20MB
    multiple: true,
  });

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Upload failed");
        }

        // Pass document with embedding status
        onUploadComplete({
          ...data.document,
          uploadedAt: new Date(),
          embeddingStatus: "processing", // Will be updated via polling
        });
      }

      setFiles([]);
    } catch (err: any) {
      setError(err.message || "Failed to upload documents");
      console.error(err);
    } finally {
      setUploading(true);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className={cn("space-y-4", className)}>
      <Card
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
          isDragActive && "border-blue-500 bg-blue-50 dark:bg-blue-950",
          !isDragActive && "hover:border-gray-400"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        {isDragActive ? (
          <p className="text-lg">Drop files here...</p>
        ) : (
          <>
            <p className="text-lg mb-2">Drag & drop documents here</p>
            <p className="text-sm text-gray-500">
              or click to select files (PDF, DOCX, TXT, MD • Max 20MB)
            </p>
          </>
        )}
      </Card>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <Card key={index} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <File className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeFile(index)}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </Card>
          ))}

          <Button
            onClick={uploadFiles}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload {files.length} {files.length === 1 ? "File" : "Files"}
              </>
            )}
          </Button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  );
}
