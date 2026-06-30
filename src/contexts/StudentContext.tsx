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
}

const DEFAULT: StudentUser = {
  name: "Student",
  email: "",
  board: "CBSE",
  cls: 7,
  streakDays: 0,
  totalPoints: 0,
  subjects: [],
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
