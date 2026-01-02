"use client";

import { useState } from "react";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { DocumentLibrary } from "@/components/documents/DocumentLibrary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DocumentsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = () => {
    // Trigger refresh of document library
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Documents</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Upload and manage your academic documents (syllabus, transcripts, etc.)
        </p>

        <Tabs defaultValue="library" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="library">My Documents</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="mt-6">
            <DocumentLibrary key={refreshKey} />
          </TabsContent>

          <TabsContent value="upload" className="mt-6">
            <div className="max-w-2xl mx-auto">
              <DocumentUpload onUploadComplete={handleUploadComplete} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
