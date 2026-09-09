export const LEAVE_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  LETTER_PENDING: 'Approved · Letter Pending',
  LETTER_POSTED: 'Letter Posted',
  REP_CONFIRMED: 'Representative Confirmed',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

export const OD_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  LETTER_REQUIRED: 'Approved · Letter Required',
  LETTER_POSTED: 'Letter Posted',
  REP_CONFIRMED: 'Representative Confirmed',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

export const STATUS_TONE: Record<string, string> = {
  PENDING: 'amber',
  LETTER_PENDING: 'blue',
  LETTER_REQUIRED: 'blue',
  LETTER_POSTED: 'blue',
  REP_CONFIRMED: 'green',
  APPROVED: 'green',
  REJECTED: 'red',
  WITHDRAWN: 'gray',
  SUBMITTED: 'green',
  NOT_SUBMITTED: 'red',
  COMPLETED: 'green',
  NOT_COMPLETED: 'gray',
  VERIFIED: 'green',
  PRESENT: 'green',
  NOT_COMING: 'red',
  LATE: 'amber',
  HALF_DAY: 'blue',
  OUT: 'amber',
  BACK: 'green',
  CLEARED: 'gray',
  ACTIVE: 'blue',
  OPEN: 'amber',
  RESOLVED: 'green',
  DISMISSED: 'gray',
  EXECUTED: 'green',
  CANCELLED: 'gray',
};

export const DAILY_STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Present',
  NOT_COMING: 'Not Coming',
  LATE: 'Late',
  HALF_DAY: 'Half Day',
};
