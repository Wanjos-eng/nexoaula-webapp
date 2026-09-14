import type { Metadata } from "next";
import { AcademicProfile } from "@/modules/academic/components/AcademicProfile";
export const metadata: Metadata = { title: "Meu perfil" };
export default function PerfilPage() { return <AcademicProfile />; }
