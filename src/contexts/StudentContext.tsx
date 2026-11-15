"use client";

import { createContext, useContext } from "react";

export interface StudentUser {
  name: string;
  email: string;
  board: string;
  cls: number;
  streakDays: number;
  totalPoints: number;
  subjects: string[];
  /** Credit wallet balance; null when unavailable (e.g. wallet tables not deployed yet). */
  creditBalance: number | null;
}

const DEFAULT: StudentUser = {
  name: "Student",
  email: "",
  board: "CBSE",
  cls: 7,
  streakDays: 0,
  totalPoints: 0,
  subjects: [],
  creditBalance: null,
};

const StudentContext = createContext<StudentUser>(DEFAULT);

export function StudentProvider({
  user,
  children,
}: {
  user: StudentUser;
  children: React.ReactNode;
}) {
  return <StudentContext.Provider value={user}>{children}</StudentContext.Provider>;
}

export function useStudent(): StudentUser {
  return useContext(StudentContext);
}
