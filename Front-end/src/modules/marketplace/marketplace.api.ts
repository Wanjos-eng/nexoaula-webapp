"use client";

import { useEffect, useState } from "react";

import { apiClient, ApiError } from "@/lib/api";
import type {
	EnrollmentReceipt,
	SessionBooking,
	TutorProfile,
	TutorSession,
} from "./marketplace.types";

export type SessionInput = {
	subject_id: string;
	title: string;
	description?: string | null;
	modality: "online" | "in_person" | "hybrid";
	location?: string | null;
	external_url?: string | null;
	starts_at: string;
	ends_at: string;
	capacity: number;
	price_cents: number;
};

export function apiErrorMessage(error: unknown): string {
	if (error instanceof ApiError) {
		const body = error.body as { detail?: unknown } | null;
		if (typeof body?.detail === "string") return body.detail;
		if (error.status === 409) return "Os dados mudaram no servidor. Atualize e tente novamente.";
		if (error.status === 401) return "Sua sessão expirou. Entre novamente para continuar.";
	}
	return "Não foi possível concluir a operação. Verifique sua conexão e tente novamente.";
}

export async function listSessions(): Promise<TutorSession[]> {
	return (await apiClient.get<TutorSession[]>("/v1/marketplace/sessions")).data;
}

export async function getSession(id: string): Promise<TutorSession> {
	return (await apiClient.get<TutorSession>(`/v1/marketplace/sessions/${id}`)).data;
}

export async function readTutorProfile(): Promise<TutorProfile | null> {
	return (await apiClient.get<TutorProfile | null>("/v1/marketplace/tutor")).data;
}

export async function activateTutorProfile(headline: string, bio: string): Promise<TutorProfile> {
	return (await apiClient.post<TutorProfile>("/v1/marketplace/tutor/activate", { body: { headline, bio } })).data;
}

export async function listMySessions(): Promise<TutorSession[]> {
	return (await apiClient.get<TutorSession[]>("/v1/marketplace/sessions/mine")).data;
}

export async function createSession(input: SessionInput): Promise<TutorSession> {
	return (await apiClient.post<TutorSession>("/v1/marketplace/sessions", { body: input })).data;
}

export async function publishSession(id: string): Promise<TutorSession> {
	return (await apiClient.post<TutorSession>(`/v1/marketplace/sessions/${id}/publish`, { body: {} })).data;
}

export async function enrollSession(id: string): Promise<EnrollmentReceipt> {
	return (await apiClient.post<EnrollmentReceipt>(`/v1/marketplace/sessions/${id}/enroll`, { body: {} })).data;
}

export async function cancelEnrollment(id: string): Promise<void> {
	await apiClient.del(`/v1/marketplace/sessions/${id}/enroll`, { body: {} });
}

export async function listMyBookings(): Promise<SessionBooking[]> {
	return (await apiClient.get<SessionBooking[]>("/v1/marketplace/bookings/mine")).data;
}

function useRemoteList<T>(reader: () => Promise<T>, initial: T) {
	const [data, setData] = useState(initial);
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		let active = true;
		reader().then((value) => {
			if (active) { setData(value); setLoaded(true); }
		}).catch((cause: unknown) => {
			if (active) { setError(apiErrorMessage(cause)); setLoaded(true); }
		});
		return () => { active = false; };
	}, [reader]);
	return { data, loaded, error };
}

export function useSessions() {
	return useRemoteList(listSessions, [] as TutorSession[]);
}

export function useMyBookings() {
	return useRemoteList(listMyBookings, [] as SessionBooking[]);
}

export function useMySessions() {
	return useRemoteList(listMySessions, [] as TutorSession[]);
}

export function useTutorProfile() {
	return useRemoteList(readTutorProfile, null as TutorProfile | null);
}
