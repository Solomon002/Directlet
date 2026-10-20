import type { UserRole } from "../stores/authStore";

export function homePathFor(role: UserRole): string {
  return role === "LANDLORD" ? "/landlord" : "/tenant";
}
