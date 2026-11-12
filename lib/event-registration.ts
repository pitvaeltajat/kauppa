const DAY_MS = 24 * 60 * 60 * 1000;

/** The deadline date remains cancellable through the end of that calendar day. */
export function canCancelEventRegistration(deadline: Date | null, now = new Date()): boolean {
  return !deadline || now.getTime() < deadline.getTime() + DAY_MS;
}

export function defaultRegistrationDeadline(startsAt: Date): Date {
  return new Date(startsAt.getTime() - 5 * DAY_MS);
}
