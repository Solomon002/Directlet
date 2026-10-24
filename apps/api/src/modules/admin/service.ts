import { prisma } from "../../lib/prisma";
import { Prisma } from "../../generated/prisma/client";
import type { UserRole } from "../../generated/prisma/enums";
import { AppError } from "../../utils/AppError";
import { addDays, startOfTodayUtc } from "../../lib/rentPeriod";
import { publiclyVisible } from "../public/service";

const PAGE_SIZE = 25;
const SERIES_DAYS = 30;

function money(value: Prisma.Decimal | null | undefined) {
  return (value ?? new Prisma.Decimal(0)).toFixed(2);
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

// One entry per day for the last SERIES_DAYS days, oldest first, so charts
// show zero-days instead of skipping them.
function emptySeries(today: Date) {
  return Array.from({ length: SERIES_DAYS }, (_, i) => dayKey(addDays(today, i - SERIES_DAYS + 1)));
}

export async function getOverview() {
  const today = startOfTodayUtc();
  const seriesStart = addDays(today, -SERIES_DAYS + 1);
  const weekAgo = addDays(today, -6);

  const [
    usersByRole,
    suspendedUsers,
    newUsers7d,
    newUsers30d,
    signupRows,
    propertyCount,
    listedCount,
    hiddenByAdminCount,
    pinnedCount,
    unitCount,
    activeTenancies,
    endedTenancies,
    confirmed,
    confirmed30d,
    pending,
    chargeTotals,
    overdueRows,
    complaintsByStatus,
    inspectionsByStatus,
    conversationCount,
    messageCount,
    messages7d,
    viewRows,
    topPathRows,
    referrerRows,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.user.count({ where: { suspendedAt: { not: null } } }),
    prisma.user.groupBy({ by: ["role"], where: { createdAt: { gte: weekAgo } }, _count: true }),
    prisma.user.groupBy({ by: ["role"], where: { createdAt: { gte: seriesStart } }, _count: true }),
    prisma.$queryRaw<{ day: Date; role: UserRole; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt")::date AS day, role, COUNT(*) AS count
      FROM "User" WHERE "createdAt" >= ${seriesStart}
      GROUP BY 1, 2`,
    prisma.property.count(),
    prisma.property.count({ where: publiclyVisible }),
    prisma.property.count({ where: { hiddenByAdminAt: { not: null } } }),
    prisma.property.count({ where: { latitude: { not: null } } }),
    prisma.unit.count(),
    prisma.tenancy.count({ where: { status: "ACTIVE" } }),
    prisma.tenancy.count({ where: { status: "ENDED" } }),
    prisma.payment.aggregate({ where: { status: "CONFIRMED" }, _sum: { amount: true }, _count: true }),
    prisma.payment.aggregate({
      where: { status: "CONFIRMED", confirmedAt: { gte: seriesStart } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({ where: { status: "PENDING" }, _sum: { amount: true }, _count: true }),
    prisma.rentCharge.aggregate({ _sum: { amount: true, amountPaid: true } }),
    prisma.$queryRaw<{ overdue: Prisma.Decimal | null }[]>`
      SELECT SUM(amount - "amountPaid") AS overdue FROM "RentCharge"
      WHERE "dueDate" < ${today} AND amount > "amountPaid"`,
    prisma.complaint.groupBy({ by: ["status"], _count: true }),
    prisma.inspectionRequest.groupBy({ by: ["status"], _count: true }),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.message.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.$queryRaw<{ day: Date; views: bigint; visitors: bigint }[]>`
      SELECT day, COUNT(*) AS views, COUNT(DISTINCT "visitorHash") AS visitors
      FROM "PageView" WHERE day >= ${seriesStart}
      GROUP BY day`,
    prisma.pageView.groupBy({
      by: ["path"],
      where: { day: { gte: seriesStart } },
      _count: true,
      orderBy: { _count: { path: "desc" } },
      take: 10,
    }),
    prisma.pageView.groupBy({
      by: ["referrer"],
      where: { day: { gte: seriesStart }, referrer: { not: null } },
      _count: true,
      orderBy: { _count: { referrer: "desc" } },
      take: 8,
    }),
  ]);

  const countByRole = (rows: { role: UserRole; _count: number }[]) =>
    Object.fromEntries(rows.map((row) => [row.role, row._count])) as Partial<Record<UserRole, number>>;

  // Daily sign-ups split by role, and daily traffic.
  const days = emptySeries(today);
  const signups = new Map(days.map((d) => [d, { LANDLORD: 0, HUNTER: 0, TENANT: 0 }]));
  for (const row of signupRows) {
    const entry = signups.get(dayKey(row.day));
    if (entry && row.role in entry) entry[row.role as keyof typeof entry] += Number(row.count);
  }
  const traffic = new Map(days.map((d) => [d, { views: 0, visitors: 0 }]));
  for (const row of viewRows) {
    const entry = traffic.get(dayKey(row.day));
    if (entry) {
      entry.views = Number(row.views);
      entry.visitors = Number(row.visitors);
    }
  }
  const series = days.map((day) => ({ day, signups: signups.get(day)!, ...traffic.get(day)! }));
  const sumLast = (n: number, key: "views" | "visitors") =>
    series.slice(-n).reduce((sum, d) => sum + d[key], 0);

  // Top pages; compound pages are labelled with the compound's name.
  const topPaths = topPathRows.map((row) => [row.path, row._count] as const);
  const compoundIds = topPaths
    .map(([path]) => /^\/compounds\/([0-9a-f-]{36})$/i.exec(path)?.[1])
    .filter((id): id is string => Boolean(id));
  const compoundNames = new Map(
    (await prisma.property.findMany({ where: { id: { in: compoundIds } }, select: { id: true, name: true } })).map(
      (p) => [p.id, p.name],
    ),
  );

  const unpaid = (chargeTotals._sum.amount ?? new Prisma.Decimal(0)).minus(chargeTotals._sum.amountPaid ?? 0);

  return {
    users: {
      byRole: countByRole(usersByRole),
      suspended: suspendedUsers,
      new7d: countByRole(newUsers7d),
      new30d: countByRole(newUsers30d),
    },
    properties: {
      total: propertyCount,
      listed: listedCount,
      hiddenByAdmin: hiddenByAdminCount,
      withMapPin: pinnedCount,
      units: unitCount,
      occupiedUnits: activeTenancies,
      vacantUnits: unitCount - activeTenancies,
    },
    tenancies: { active: activeTenancies, ended: endedTenancies },
    money: {
      confirmedTotal: money(confirmed._sum.amount),
      confirmedCount: confirmed._count,
      confirmed30d: money(confirmed30d._sum.amount),
      pendingAmount: money(pending._sum.amount),
      pendingCount: pending._count,
      outstanding: money(unpaid),
      overdue: money(overdueRows[0]?.overdue),
    },
    complaints: Object.fromEntries(complaintsByStatus.map((row) => [row.status, row._count])),
    inspections: Object.fromEntries(inspectionsByStatus.map((row) => [row.status, row._count])),
    messaging: { conversations: conversationCount, messages: messageCount, messages7d },
    traffic: {
      viewsToday: series.at(-1)!.views,
      visitorsToday: series.at(-1)!.visitors,
      views7d: sumLast(7, "views"),
      visitors7d: sumLast(7, "visitors"),
      views30d: sumLast(SERIES_DAYS, "views"),
      visitors30d: sumLast(SERIES_DAYS, "visitors"),
      topPages: topPaths.map(([path, views]) => {
        const id = /^\/compounds\/([0-9a-f-]{36})$/i.exec(path)?.[1];
        return { path, label: id ? (compoundNames.get(id) ?? "Removed compound") : null, views };
      }),
      topReferrers: referrerRows.map((row) => ({ referrer: row.referrer!, views: row._count })),
    },
    series,
  };
}

// --- Users ---

export async function listUsers(params: { q?: string; role?: UserRole; suspended?: boolean; page: number }) {
  const where: Prisma.UserWhereInput = {
    ...(params.role ? { role: params.role } : {}),
    ...(params.suspended ? { suspendedAt: { not: null } } : {}),
    ...(params.q
      ? {
          OR: [
            { email: { contains: params.q, mode: "insensitive" } },
            { fullName: { contains: params.q, mode: "insensitive" } },
            { phone: { contains: params.q } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        createdAt: true,
        suspendedAt: true,
        passwordHash: true,
        _count: { select: { properties: true, tenancies: true } },
        // The newest session shows when they last used the app.
        refreshTokens: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map(({ passwordHash, refreshTokens, _count, ...user }) => ({
      ...user,
      // An invited tenant who never set a password has not activated yet.
      activated: passwordHash !== null,
      properties: _count.properties,
      tenancies: _count.tenancies,
      lastActiveAt: refreshTokens[0]?.createdAt ?? null,
    })),
    total,
    page: params.page,
    pageSize: PAGE_SIZE,
  };
}

export async function getUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      createdAt: true,
      suspendedAt: true,
      suspendedReason: true,
      passwordHash: true,
      inviteExpiresAt: true,
      properties: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          area: true,
          city: true,
          isPublic: true,
          hiddenByAdminAt: true,
          _count: { select: { units: true } },
        },
      },
      tenancies: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          startDate: true,
          rentAmount: true,
          rentFrequency: true,
          unit: { select: { label: true, property: { select: { id: true, name: true } } } },
        },
      },
      refreshTokens: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      _count: { select: { messagesSent: true, complaintsRaised: true } },
    },
  });

  if (!user) {
    throw new AppError(404, "User not found", "NOT_FOUND");
  }

  const recentActivity = await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, method: true, path: true, statusCode: true, createdAt: true },
  });

  const { passwordHash, refreshTokens, _count, ...rest } = user;
  return {
    ...rest,
    activated: passwordHash !== null,
    lastActiveAt: refreshTokens[0]?.createdAt ?? null,
    messagesSent: _count.messagesSent,
    complaintsRaised: _count.complaintsRaised,
    recentActivity,
  };
}

export async function suspendUser(adminId: string, userId: string, reason: string | undefined) {
  if (adminId === userId) {
    throw new AppError(400, "You cannot suspend your own account", "CANNOT_SUSPEND_SELF");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, "User not found", "NOT_FOUND");
  }
  if (user.role === "ADMIN") {
    throw new AppError(400, "Admins cannot be suspended from the panel", "CANNOT_SUSPEND_ADMIN");
  }

  // Deleting their refresh tokens signs them out everywhere. An access token
  // already issued stays valid for at most its 15-minute lifetime.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: new Date(), suspendedReason: reason ?? null },
    }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
  ]);
}

export async function unsuspendUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, "User not found", "NOT_FOUND");
  }
  await prisma.user.update({ where: { id: userId }, data: { suspendedAt: null, suspendedReason: null } });
}

// --- Properties ---

export async function listProperties(params: { q?: string; hidden?: boolean; page: number }) {
  const where: Prisma.PropertyWhereInput = {
    ...(params.hidden ? { hiddenByAdminAt: { not: null } } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" } },
            { area: { contains: params.q, mode: "insensitive" } },
            { city: { contains: params.q, mode: "insensitive" } },
            { landlord: { fullName: { contains: params.q, mode: "insensitive" } } },
            { landlord: { email: { contains: params.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        area: true,
        city: true,
        isPublic: true,
        latitude: true,
        hiddenByAdminAt: true,
        hiddenByAdminReason: true,
        createdAt: true,
        landlord: { select: { id: true, fullName: true, email: true, suspendedAt: true } },
        units: { select: { _count: { select: { tenancies: { where: { status: "ACTIVE" } } } } } },
      },
    }),
    prisma.property.count({ where }),
  ]);

  return {
    properties: properties.map(({ units, latitude, ...property }) => ({
      ...property,
      hasMapPin: latitude !== null,
      units: units.length,
      occupiedUnits: units.filter((unit) => unit._count.tenancies > 0).length,
      // What a visitor sees right now, after every rule is applied.
      visibleToPublic: property.isPublic && !property.hiddenByAdminAt && !property.landlord.suspendedAt,
    })),
    total,
    page: params.page,
    pageSize: PAGE_SIZE,
  };
}

export async function setPropertyHidden(propertyId: string, hidden: boolean, reason?: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) {
    throw new AppError(404, "Property not found", "NOT_FOUND");
  }
  await prisma.property.update({
    where: { id: propertyId },
    data: hidden
      ? { hiddenByAdminAt: new Date(), hiddenByAdminReason: reason ?? null }
      : { hiddenByAdminAt: null, hiddenByAdminReason: null },
  });
}

// --- Activity ---

export async function listActivity(params: { userId?: string; failedOnly?: boolean; page: number }) {
  const where: Prisma.AuditLogWhereInput = {
    ...(params.userId ? { userId: params.userId } : {}),
    ...(params.failedOnly ? { statusCode: { gte: 400 } } : {}),
  };
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        method: true,
        path: true,
        statusCode: true,
        entity: true,
        entityId: true,
        createdAt: true,
        user: { select: { id: true, fullName: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { entries, total, page: params.page, pageSize: PAGE_SIZE };
}
