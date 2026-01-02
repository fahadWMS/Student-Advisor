"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Download, Trash2, Search, Filter, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Document {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  storageUrl: string;
  category: string;
  tags: string[];
  createdAt: string;
  vectorized?: boolean;
  embeddingError?: string;
  chunkCount?: number;
}

export function DocumentLibrary() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    filterDocuments();
  }, [documents, searchQuery, categoryFilter]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch("/api/documents");
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterDocuments = () => {
    let filtered = documents;

    if (categoryFilter !== "all") {
      filtered = filtered.filter((doc) => doc.category === categoryFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter((doc) =>
        doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredDocs(filtered);
  };

  const requestDelete = (doc: Document) => {
    setDeleteError(null);
    setPendingDelete(doc);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setDeletingId(id);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete document");
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      setPendingDelete(null);
    } catch (error) {
      console.error("Failed to delete document:", error);
      setDeleteError("Unable to delete document. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const closeDeleteDialog = () => {
    if (deletingId) return;
    setPendingDelete(null);
    setDeleteError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return <div className="text-center py-8">Loading documents...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="all">All Categories</option>
          <option value="syllabus">Syllabus</option>
          <option value="transcript">Transcript</option>
          <option value="resume">Resume</option>
          <option value="assignment">Assignment</option>
          <option value="other">Other</option>
        </select>

        <Button
          variant="outline"
          onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
        >
          {viewMode === "grid" ? "List" : "Grid"} View
        </Button>
      </div>

      {/* Documents */}
      {filteredDocs.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">No documents found</p>
        </Card>
      ) : (
        <div
          className={cn(
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              : "space-y-2"
          )}
        >
          {filteredDocs.map((doc) => (
            <Card key={doc.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(doc.storageUrl || doc.storagePath, "_blank")}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => requestDelete(doc)}
                      title="Delete"
                      disabled={deletingId === doc.id}
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-red-600" />
                      )}
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-sm truncate" title={doc.fileName}>
                  {doc.fileName}
                </CardTitle>
                <CardDescription>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded">
                      {doc.category}
                    </span>
                    <span className="text-xs">{formatFileSize(doc.fileSize)}</span>
                    {doc.vectorized === true && (
                      <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded flex items-center gap-1">
                        ✓ Embedded ({doc.chunkCount || 0} chunks)
                      </span>
                    )}
                    {doc.vectorized === false && !doc.embeddingError && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-1 rounded flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Processing...
                      </span>
                    )}
                    {doc.embeddingError && (
                      <span className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-2 py-1 rounded">
                        ⚠ Error
                      </span>
                    )}
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">{formatDate(doc.createdAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => (open ? undefined : closeDeleteDialog())}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `Are you sure you want to permanently delete “${pendingDelete.fileName}”?`
                : "This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-red-500" role="alert">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeDeleteDialog} disabled={Boolean(deletingId)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={!pendingDelete || deletingId === pendingDelete.id}
            >
              {pendingDelete && deletingId === pendingDelete.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
