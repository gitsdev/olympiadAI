import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import {
  getStudentById, getStudentStats, getStudentSubjectProgress,
  getStudentTopicProgress, getStudentActivity, getStudentMockTests,
} from "@/lib/admin/students";
import { getStudentAiSessions } from "@/lib/admin/ai-tutor";
import { computeInsights } from "@/lib/admin/insights";
import { AdminShell } from "@/components/admin/AdminShell";
import { StudentProfileHeader } from "@/components/admin/StudentProfileHeader";
import { StudentOverviewCards } from "@/components/admin/StudentOverviewCards";
import { StudentDetailTabs } from "@/components/admin/StudentDetailTabs";
import { ActivityTimeline } from "@/components/admin/ActivityTimeline";
import { SubjectProgress } from "@/components/admin/SubjectProgress";
import { TopicProgressTree } from "@/components/admin/TopicProgressTree";
import { MockTestTable } from "@/components/admin/MockTestTable";
import { MockTestPerformanceChart } from "@/components/admin/MockTestPerformanceChart";
import { AITutorSessionList } from "@/components/admin/AITutorSessionList";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ studentId: string }>;
}

export default async function StudentDetailPage({ params }: PageProps) {
  const admin = await requireAdmin();
  const { studentId } = await params;

  const profileData = await getStudentById(studentId);
  if (!profileData) notFound();
  const { student, profile } = profileData;

  const [stats, subjectProgress, topicProgress, activity, mockTests, aiSessions] = await Promise.all([
    getStudentStats(studentId),
    getStudentSubjectProgress(studentId),
    getStudentTopicProgress(studentId),
    getStudentActivity(studentId, 30),
    getStudentMockTests(studentId, 1),
    getStudentAiSessions(studentId, 1),
  ]);

  const insights = computeInsights(subjectProgress, topicProgress);
  const aiSubjectCounts = new Map<string, number>();
  for (const s of aiSessions.rows) {
    if (s.subject) aiSubjectCounts.set(s.subject, (aiSubjectCounts.get(s.subject) ?? 0) + 1);
  }
  const topAiSubjects = [...aiSubjectCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <AdminShell adminName={admin.fullName} title={profile.full_name} subtitle="Student 360° profile">
      <div className="flex flex-col gap-5">
        <StudentProfileHeader studentId={studentId} student={student} profile={profile} />

        {stats && <StudentOverviewCards stats={stats} />}

        <StudentDetailTabs
          overview={
            <div className="grid lg:grid-cols-2 gap-4">
              <OACard>
                <OACardHeader><OACardTitle>Recent Activity</OACardTitle></OACardHeader>
                <ActivityTimeline events={activity.slice(0, 8)} />
              </OACard>
              <OACard>
                <OACardHeader><OACardTitle>Subject Progress</OACardTitle></OACardHeader>
                <SubjectProgress rows={subjectProgress} />
              </OACard>
              <OACard className="lg:col-span-2">
                <OACardHeader><OACardTitle>Performance Insights</OACardTitle></OACardHeader>
                <div className="flex flex-col gap-3">
                  {insights.map((ins) => (
                    <div key={ins.label} className="flex items-start gap-3">
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                        style={{ background: ins.tone === "positive" ? "var(--success)" : "var(--gold-500)" }}
                      />
                      <div>
                        <p className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{ins.label}</p>
                        <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>{ins.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </OACard>
            </div>
          }
          activity={
            <OACard>
              <OACardHeader><OACardTitle>Full Activity Timeline</OACardTitle></OACardHeader>
              <ActivityTimeline events={activity} />
            </OACard>
          }
          mockTests={
            <div className="flex flex-col gap-4">
              <OACard>
                <OACardHeader><OACardTitle>Score Trend</OACardTitle></OACardHeader>
                <MockTestPerformanceChart attempts={mockTests.rows} />
              </OACard>
              <div className="rounded-[var(--r-lg)] border overflow-hidden" style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}>
                <MockTestTable rows={mockTests.rows} showStudent={false} />
              </div>
            </div>
          }
          aiTutor={
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <OACard>
                  <OACardHeader><OACardTitle>Recent Sessions</OACardTitle></OACardHeader>
                  <AITutorSessionList sessions={aiSessions.rows} basePath="/admin/ai-tutor/session" />
                </OACard>
              </div>
              <OACard>
                <OACardHeader><OACardTitle>Most Discussed Subjects</OACardTitle></OACardHeader>
                {topAiSubjects.length === 0 ? (
                  <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>No sessions yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {topAiSubjects.map(([subject, count]) => (
                      <li key={subject} className="flex items-center justify-between text-[13px]">
                        <span style={{ color: "var(--ink-900)" }}>{subject}</span>
                        <span style={{ color: "var(--fg-muted)" }}>{count} session{count === 1 ? "" : "s"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </OACard>
            </div>
          }
          progress={
            <div className="grid lg:grid-cols-2 gap-4">
              <OACard>
                <OACardHeader><OACardTitle>Progress by Subject</OACardTitle></OACardHeader>
                <SubjectProgress rows={subjectProgress} />
              </OACard>
              <OACard>
                <OACardHeader><OACardTitle>Progress by Chapter / Topic</OACardTitle></OACardHeader>
                <TopicProgressTree rows={topicProgress} />
              </OACard>
            </div>
          }
        />
      </div>
    </AdminShell>
  );
}
