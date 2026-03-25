import { formatInTimeZone } from 'date-fns-tz'

const TZ = 'Asia/Bangkok'

export function toBangkokDateString(date: Date = new Date()): string {
  return formatInTimeZone(date, TZ, 'yyyy-MM-dd')
}

export function isSameDay(a: string, b: string): boolean {
  return a === b
}

// Note: date range arithmetic for the random-pick exclusion window is done inline
// in the API route using date-fns subDays + formatInTimeZone. No helper needed here.
