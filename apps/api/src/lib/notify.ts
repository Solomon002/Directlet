import { env } from "../config/env";
import { sendInBackground } from "./email";

// The emails DirectLet sends, in plain words. Each one only tells the person that
// something happened and where to look; no private details are put in them.

const SIGN_OFF = "\nDirectLet: No Agent Wahala.";

function link(path: string) {
  return `${env.WEB_ORIGIN}${path}`;
}

function formatDay(date: Date) {
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function sendVerificationEmail(to: string, fullName: string, token: string) {
  sendInBackground({
    to,
    subject: "Confirm your email for DirectLet",
    text: `Hello ${fullName},\n\nConfirm your email address so landlords know you are real:\n${link(`/verify-email?token=${token}`)}\n\nThe link works for 24 hours. If you did not create a DirectLet account, ignore this email.${SIGN_OFF}`,
  });
}

export function notifyLandlordOfRequest(to: string, property: string, unit: string) {
  sendInBackground({
    to,
    subject: `New viewing request for ${unit} at ${property}`,
    text: `Someone has asked to view ${unit} at ${property}.\n\nOpen your inspection requests to accept a day or decline:\n${link("/landlord/inspections")}\n\nTheir phone and email are shared with you once you accept.${SIGN_OFF}`,
  });
}

export function notifyVisitorOfAnswer(
  to: string,
  fullName: string,
  property: string,
  unit: string,
  outcome: { kind: "ACCEPTED" | "RESCHEDULED"; day: Date } | { kind: "DECLINED" },
) {
  const what =
    outcome.kind === "DECLINED"
      ? `The landlord has declined your request to view ${unit} at ${property}.`
      : outcome.kind === "ACCEPTED"
        ? `Your viewing of ${unit} at ${property} is confirmed for ${formatDay(outcome.day)}.`
        : `The landlord moved your viewing of ${unit} at ${property} to ${formatDay(outcome.day)}.`;
  sendInBackground({
    to,
    subject: outcome.kind === "DECLINED" ? "Your viewing request was declined" : "Your viewing day",
    text: `Hello ${fullName},\n\n${what}\n\nSee the details, or cancel if you cannot make it:\n${link("/viewings")}\n\nMeet the owner at the property, and do not pay anything before you have seen it.${SIGN_OFF}`,
  });
}

export function sendViewingReminder(
  to: string,
  fullName: string,
  property: string,
  unit: string,
  day: Date,
  audience: "VISITOR" | "LANDLORD",
) {
  const where = audience === "VISITOR" ? link("/viewings") : link("/landlord/inspections");
  sendInBackground({
    to,
    subject: `Reminder: viewing tomorrow at ${property}`,
    text: `Hello ${fullName},\n\nA reminder that ${unit} at ${property} is booked for viewing on ${formatDay(day)}.\n\n${
      audience === "VISITOR" ? "If you cannot make it, please cancel so the landlord is not left waiting" : "If you cannot be there, move the date so the visitor is not left waiting"
    }:\n${where}${SIGN_OFF}`,
  });
}

export function notifyLandlordOfHiddenListing(to: string, fullName: string, property: string) {
  sendInBackground({
    to,
    subject: `Your listing "${property}" is paused`,
    text: `Hello ${fullName},\n\nSeveral people reported "${property}", so we have paused it while the DirectLet team checks it. This is not a decision yet.\n\nIf the listing is accurate it will be restored. You can still manage your tenants and viewings in the meantime:\n${link("/landlord")}${SIGN_OFF}`,
  });
}
