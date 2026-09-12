"use client";

import { useEffect, useState } from "react";

import { mockSessions } from "./marketplace.mock";
import type { SessionBooking, TutorSession } from "./marketplace.types";

const SESSIONS_KEY = "nexoaula:demo-sessions:v1";
const BOOKINGS_KEY = "nexoaula:demo-bookings:v1";
const PROFILE_KEY = "nexoaula:demo-tutor-profile:v1";
const CHANGE_EVENT = "nexoaula:marketplace-demo-change";

function readArray<T>(key: string): T[] {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, values: T[]): void {
  window.sessionStorage.setItem(key, JSON.stringify(values));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function readDemoSessions(): TutorSession[] {
  const byId = new Map(mockSessions.map((session) => [session.id, session]));
  for (const session of readArray<TutorSession>(SESSIONS_KEY)) byId.set(session.id, session);
  return [...byId.values()];
}

export function useDemoSessions(): { sessions: TutorSession[]; loaded: boolean } {
  const [sessions, setSessions] = useState<TutorSession[]>(mockSessions);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sync = () => {
      setSessions(readDemoSessions());
      setLoaded(true);
    };
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  return { sessions, loaded };
}

export function publishDemoSession(session: TutorSession): void {
  writeArray(SESSIONS_KEY, [...readArray<TutorSession>(SESSIONS_KEY), session]);
}

type DemoTutorProfile = { headline: string; bio: string };

function readDemoTutorProfile(userId: string): DemoTutorProfile | null {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(`${PROFILE_KEY}:${userId}`) ?? "null");
    if (parsed && typeof parsed === "object" && "headline" in parsed && "bio" in parsed) {
      return parsed as DemoTutorProfile;
    }
  } catch {
    // A demonstração continua sem perfil caso o armazenamento esteja indisponível.
  }
  return null;
}

export function useDemoTutorProfile(userId: string): DemoTutorProfile | null {
  const [profile, setProfile] = useState<DemoTutorProfile | null>(null);
  useEffect(() => {
    const sync = () => setProfile(readDemoTutorProfile(userId));
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, [userId]);
  return profile;
}

export function activateDemoTutorProfile(userId: string, profile: DemoTutorProfile): void {
  window.sessionStorage.setItem(`${PROFILE_KEY}:${userId}`, JSON.stringify(profile));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function readDemoBookings(userId: string): SessionBooking[] {
  return readArray<SessionBooking>(`${BOOKINGS_KEY}:${userId}`);
}

export function useDemoBookings(userId: string): SessionBooking[] {
  const [bookings, setBookings] = useState<SessionBooking[]>([]);

  useEffect(() => {
    const sync = () => setBookings(readDemoBookings(userId));
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, [userId]);

  return bookings;
}

export function enrollDemoSession(userId: string, session: TutorSession): SessionBooking {
  const booking: SessionBooking = {
    id: crypto.randomUUID(),
    session,
    status: "confirmed",
    booked_at: new Date().toISOString(),
    cancelled_at: null,
  };
  const key = `${BOOKINGS_KEY}:${userId}`;
  writeArray(key, [...readArray<SessionBooking>(key), booking]);
  const stored = readArray<TutorSession>(SESSIONS_KEY).filter((item) => item.id !== session.id);
  writeArray(SESSIONS_KEY, [...stored, { ...session, enrolled_count: session.enrolled_count + 1 }]);
  return booking;
}

export function cancelDemoBooking(userId: string, bookingId: string): void {
  const key = `${BOOKINGS_KEY}:${userId}`;
  const booking = readArray<SessionBooking>(key).find((item) => item.id === bookingId);
  writeArray(
    key,
    readArray<SessionBooking>(key).map((booking) =>
      booking.id === bookingId
        ? { ...booking, status: "cancelled", cancelled_at: new Date().toISOString() }
        : booking,
    ),
  );
  if (booking?.status === "confirmed") {
    const session = readDemoSessions().find((item) => item.id === booking.session.id);
    if (session) {
      const stored = readArray<TutorSession>(SESSIONS_KEY).filter((item) => item.id !== session.id);
      writeArray(SESSIONS_KEY, [...stored, { ...session, enrolled_count: Math.max(0, session.enrolled_count - 1) }]);
    }
  }
}
