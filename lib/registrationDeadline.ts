// Tournament dates are stored as UTC midnight of the calendar day. A deadline
// stays open through the end of its day; an "opens" date starts at the
// beginning of its day.

const DAY_MS = 24 * 60 * 60 * 1000;

export function registrationIsOpen(deadline: Date, now: Date = new Date()): boolean {
  return now.getTime() < deadline.getTime() + DAY_MS;
}

export type RegistrationStatus = "not_open" | "open" | "closed";

export function registrationStatus(
  tournament: { registrationOpensAt: Date | null; registrationDeadline: Date },
  now: Date = new Date(),
): RegistrationStatus {
  if (tournament.registrationOpensAt && now.getTime() < tournament.registrationOpensAt.getTime()) {
    return "not_open";
  }
  return registrationIsOpen(tournament.registrationDeadline, now) ? "open" : "closed";
}

/** The last day a player may withdraw: the withdrawal deadline, or the registration deadline if none is set. */
export function effectiveWithdrawalDeadline(tournament: {
  withdrawalDeadline: Date | null;
  registrationDeadline: Date;
}): Date {
  return tournament.withdrawalDeadline ?? tournament.registrationDeadline;
}

export function withdrawalIsOpen(
  tournament: { withdrawalDeadline: Date | null; registrationDeadline: Date },
  now: Date = new Date(),
): boolean {
  return registrationIsOpen(effectiveWithdrawalDeadline(tournament), now);
}
