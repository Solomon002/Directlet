import type { UserRole } from "../stores/authStore";

export function homePathFor(role: UserRole): string {
  if (role === "LANDLORD") return "/landlord";
  if (role === "TENANT") return "/tenant";
  return "/compounds";
}

// Where each role's inbox lives, inside its own layout.
export function messagesPathFor(role: UserRole): string {
  if (role === "LANDLORD") return "/landlord/messages";
  if (role === "TENANT") return "/tenant/messages";
  return "/messages";
}
