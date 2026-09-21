export function registrationIsOpen(deadline: Date, now: Date = new Date()): boolean {
  const closesAt = Date.UTC(
    deadline.getUTCFullYear(),
    deadline.getUTCMonth(),
    deadline.getUTCDate() + 1,
  );
  return now.getTime() < closesAt;
}
