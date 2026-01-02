import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, GraduationCap, Briefcase, Heart, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="flex justify-center mb-6">
            <MessageSquare className="h-16 w-16 text-blue-600" />
          </div>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AI Student Consultation Assistant
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Your personal AI advisor for academic success, career planning, and wellness support.
            Get expert guidance 24/7 powered by advanced AI technology.
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/signup">
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Log In</Link>
            </Button>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-20 grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="border-2 hover:border-blue-600 transition-colors">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <GraduationCap className="h-8 w-8 text-green-600" />
                <CardTitle>Academic Advisor</CardTitle>
              </div>
              <CardDescription>
                Get help with course selection, study strategies, and academic planning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Study techniques and time management</li>
                <li>• Course and major selection guidance</li>
                <li>• Exam preparation strategies</li>
                <li>• Academic performance improvement</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-indigo-600 transition-colors">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Briefcase className="h-8 w-8 text-indigo-600" />
                <CardTitle>Career Counselor</CardTitle>
              </div>
              <CardDescription>
                Navigate your career path with professional guidance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Resume and cover letter review</li>
                <li>• Interview preparation tips</li>
                <li>• Internship and job search strategies</li>
                <li>• Career exploration and planning</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-rose-600 transition-colors">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Heart className="h-8 w-8 text-rose-600" />
                <CardTitle>Wellness Guide</CardTitle>
              </div>
              <CardDescription>
                Support for mental health and work-life balance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Stress management techniques</li>
                <li>• Work-life balance strategies</li>
                <li>• Coping with academic pressure</li>
                <li>• Mental wellness resources</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Join thousands of students getting personalized AI-powered guidance
          </p>
          <Button asChild size="lg">
            <Link href="/signup">
              Create Your Free Account
            </Link>
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-20 py-8 text-center text-sm text-gray-600 dark:text-gray-400">
        <p>© 2024 AI Student Consultation Assistant. All rights reserved.</p>
      </footer>
    </div>
  );
}
