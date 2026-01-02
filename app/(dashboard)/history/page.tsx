"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, MessageSquare, Trash2, Search, Loader2 } from "lucide-react";
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

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await fetch("/api/chat/conversations");
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestDelete = (conversation: Conversation) => {
    setPendingDelete(conversation);
    setDeleteError(null);
  };

  const closeDeleteDialog = () => {
    setPendingDelete(null);
    setDeleteError(null);
    setDeletingId(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setDeletingId(pendingDelete.id);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/chat/conversations/${pendingDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== pendingDelete.id));
        closeDeleteDialog();
      } else {
        const data = await response.json();
        setDeleteError(data.error || "Failed to delete conversation");
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      setDeleteError("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredConversations = conversations.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupByDate = (convos: Conversation[]) => {
    const groups: { [key: string]: Conversation[] } = {
      Today: [],
      Yesterday: [],
      "Last 7 Days": [],
      "Last 30 Days": [],
      Older: [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);

    convos.forEach((convo) => {
      const date = new Date(convo.updatedAt);

      if (date >= today) {
        groups.Today.push(convo);
      } else if (date >= yesterday) {
        groups.Yesterday.push(convo);
      } else if (date >= last7Days) {
        groups["Last 7 Days"].push(convo);
      } else if (date >= last30Days) {
        groups["Last 30 Days"].push(convo);
      } else {
        groups.Older.push(convo);
      }
    });

    return groups;
  };

  const groupedConversations = groupByDate(filteredConversations);

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Conversation History
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View and manage your past conversations
        </p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {searchQuery ? "No matching conversations" : "No conversations yet"}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {searchQuery ? "Try a different search term" : "Start a new conversation to see it here"}
          </p>
          <Button onClick={() => router.push("/chat")}>Start Chatting</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedConversations).map(
            ([group, convos]) =>
              convos.length > 0 && (
                <div key={group}>
                  <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
                    {group}
                  </h2>
                  <div className="space-y-2">
                    {convos.map((conversation) => (
                      <div
                        key={conversation.id}
                        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer group"
                        onClick={() => router.push(`/chat?id=${conversation.id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-1 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                              {conversation.title}
                            </h3>
                            {conversation.lastMessage && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                {conversation.lastMessage}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {conversation.messageCount} messages
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(conversation.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDelete(conversation);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
          )}
        </div>
      )}

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => (open ? undefined : closeDeleteDialog())}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete conversation</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `Are you sure you want to permanently delete "${pendingDelete.title}"?`
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
