"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  MessageCircle,
  History,
  FileText,
  User,
  GraduationCap,
  Briefcase,
  Heart,
  Plus,
} from "lucide-react";

const routes = [
  {
    label: "Chat",
    icon: MessageSquare,
    href: "/chat",
    color: "text-blue-600",
  },
  {
    label: "History",
    icon: History,
    href: "/history",
    color: "text-violet-600",
  },
  {
    label: "Documents",
    icon: FileText,
    href: "/documents",
    color: "text-pink-600",
  },
  {
    label: "Profile",
    icon: User,
    href: "/profile",
    color: "text-orange-600",
  },
];

const personas = [
  {
    label: "Academic Advisor",
    icon: GraduationCap,
    color: "text-green-600",
    description: "Course selection & study strategies"
  },
  {
    label: "Career Counselor",
    icon: Briefcase,
    color: "text-indigo-600",
    description: "Career planning & job search"
  },
  {
    label: "Wellness Guide",
    icon: Heart,
    color: "text-rose-600",
    description: "Stress management & wellbeing"
  },
  {
    label: "General Assistant",
    icon: MessageCircle,
    color: "text-blue-600",
    description: "General questions & learning support"
  },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [latestConversationId, setLatestConversationId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch latest conversation
    const fetchLatestConversation = async () => {
      try {
        const response = await fetch('/api/chat/conversations');
        if (response.ok) {
          const data = await response.json();
          if (data.conversations && data.conversations.length > 0) {
            // Get most recent conversation (sorted by updatedAt desc)
            const latest = data.conversations[0];
            setLatestConversationId(latest.id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      }
    };

    fetchLatestConversation();
  }, [pathname]); // Refetch when pathname changes

  const handleChatClick = (e: React.MouseEvent) => {
    if (latestConversationId) {
      e.preventDefault();
      router.push(`/chat?id=${latestConversationId}`);
    }
  };

  const handleNewChat = () => {
    // Clear conversation ID and force refresh
    const timestamp = Date.now();
    router.push(`/chat?new=${timestamp}`);
  };

  return (
    <div className={cn("space-y-4 py-4 flex flex-col h-full bg-gray-50 dark:bg-gray-900", className)}>
      <div className="px-3 py-2 flex-1">
        <div className="space-y-1">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            Navigation
          </h2>
          <button
            onClick={handleNewChat}
            className={cn(
              "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:bg-white dark:hover:bg-gray-800 rounded-lg transition",
              "transparent"
            )}
            title="Start a new conversation"
          >
            <div className="flex items-center flex-1">
              <Plus className={cn("h-5 w-5 mr-3", "text-green-600")} />
              New Chat
            </div>
          </button>
          {routes.map((route) => {
            const isChatRoute = route.href === '/chat';
            return (
              <Link
                key={route.href}
                href={isChatRoute && latestConversationId ? `/chat?id=${latestConversationId}` : route.href}
                onClick={isChatRoute ? handleChatClick : undefined}
                className={cn(
                  "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:bg-white dark:hover:bg-gray-800 rounded-lg transition",
                  pathname === route.href || (pathname.startsWith('/chat') && isChatRoute)
                    ? "bg-white dark:bg-gray-800 shadow-sm"
                    : "transparent"
                )}
              >
                <div className="flex items-center flex-1">
                  <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                  {route.label}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 space-y-1">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            AI Personas
          </h2>
          {personas.map((persona) => (
            <div
              key={persona.label}
              className="text-sm flex p-3 w-full justify-start font-medium rounded-lg hover:bg-white dark:hover:bg-gray-800 transition"
              title={persona.description}
            >
              <div className="flex items-center flex-1">
                <persona.icon className={cn("h-5 w-5 mr-3", persona.color)} />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {persona.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
