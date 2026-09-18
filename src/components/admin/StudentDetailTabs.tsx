"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function StudentDetailTabs({
  overview, activity, mockTests, aiTutor, progress,
}: {
  overview: React.ReactNode; activity: React.ReactNode; mockTests: React.ReactNode;
  aiTutor: React.ReactNode; progress: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="overview" className="gap-4">
      <TabsList variant="line" className="border-b w-full justify-start" style={{ borderColor: "var(--line-200)" }}>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="mock-tests">Mock Tests</TabsTrigger>
        <TabsTrigger value="ai-tutor">AI Tutor</TabsTrigger>
        <TabsTrigger value="progress">Progress</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="activity">{activity}</TabsContent>
      <TabsContent value="mock-tests">{mockTests}</TabsContent>
      <TabsContent value="ai-tutor">{aiTutor}</TabsContent>
      <TabsContent value="progress">{progress}</TabsContent>
    </Tabs>
  );
}
