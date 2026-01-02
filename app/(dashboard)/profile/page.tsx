"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

type ProfileFormState = {
  name: string;
  email: string;
  studentId: string;
  department: string;
  major: string;
  year: string;
  bio: string;
};

export default function ProfilePage() {
  const { data: session } = useSession();
  const [formState, setFormState] = useState<ProfileFormState>({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
    studentId: "",
    department: "",
    major: "",
    year: "",
    bio: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/profile");
        if (!response.ok) {
          throw new Error("Unable to load your profile");
        }
        const data = await response.json();
        if (data.user) {
          setFormState({
            name: data.user.name || "",
            email: data.user.email || session?.user?.email || "",
            studentId: data.user.studentId || "",
            department: data.user.department || "",
            major: data.user.major || "",
            year: data.user.year ? String(data.user.year) : "",
            bio: data.user.bio || "",
          });
        }
      } catch (error) {
        console.error(error);
        setStatus({ type: "error", message: "Failed to load profile" });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [session?.user?.email]);

  const handleChange = (field: keyof ProfileFormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormState((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.name.trim()) {
      setStatus({ type: "error", message: "Name cannot be empty" });
      return;
    }

    setSaving(true);
    setStatus(null);

    const payload: Record<string, unknown> = {
      studentId: formState.studentId.trim() || null,
      department: formState.department.trim() || null,
      major: formState.major.trim() || null,
      bio: formState.bio.trim() || null,
      year: formState.year ? Number(formState.year) : null,
    };

    payload.name = formState.name.trim();

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = typeof data.error === "string" ? data.error : "Failed to update profile";
        throw new Error(errorMessage);
      }

      if (data.user) {
        setFormState({
          name: data.user.name || "",
          email: data.user.email || formState.email,
          studentId: data.user.studentId || "",
          department: data.user.department || "",
          major: data.user.major || "",
          year: data.user.year ? String(data.user.year) : "",
          bio: data.user.bio || "",
        });
      }

      setStatus({ type: "success", message: "Profile updated successfully" });
    } catch (error: any) {
      console.error("Profile update failed", error);
      setStatus({ type: "error", message: error.message || "Failed to update profile" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Profile</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Manage your account settings and preferences
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Update your student details so your advisor responses stay contextual
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formState.name}
                  onChange={handleChange("name")}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={formState.email} disabled />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="studentId">Student ID</Label>
                  <Input
                    id="studentId"
                    placeholder="e.g. ST12345"
                    value={formState.studentId}
                    onChange={handleChange("studentId")}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    min={1}
                    max={10}
                    value={formState.year}
                    onChange={handleChange("year")}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    placeholder="Computer Science"
                    value={formState.department}
                    onChange={handleChange("department")}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="major">Major</Label>
                  <Input
                    id="major"
                    placeholder="Software Engineering"
                    value={formState.major}
                    onChange={handleChange("major")}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">About you</Label>
                <Textarea
                  id="bio"
                  placeholder="Share goals, interests, or constraints the advisor should know"
                  value={formState.bio}
                  onChange={handleChange("bio")}
                  disabled={loading}
                  rows={4}
                />
              </div>

              {status && (
                <div
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                    status.type === "success"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200"
                      : "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-200"
                  }`}
                >
                  {status.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <span>{status.message}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading || saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving changes...
                  </>
                ) : (
                  "Save profile"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
