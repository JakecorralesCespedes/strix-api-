export enum USERS {
  USERS_READ = 'users.read',
  USERS_WRITE = 'users.write',
  USERS_DELETE = 'users.delete',
}
export enum DEPARTMENTS {
  DEPARTMENTS_READ = 'departments.read',
  DEPARTMENTS_WRITE = 'departments.write',
  DEPARTMENTS_DELETE = 'departments.delete',
}
export enum PERIODS {
  PERIODS_READ = 'periods.read',
  PERIODS_WRITE = 'periods.write',
  PERIODS_DELETE = 'periods.delete',
}
export enum ROLES {
  ROLES_READ = 'roles.read',
  ROLES_WRITE = 'roles.write',
  ROLES_DELETE = 'roles.delete',
}

export enum PERMISSIONS {
  PERMISSIONS_READ = 'permissions.read',
  PERMISSIONS_WRITE = 'permissions.write',
}

export enum GLOBAL_SETTINGS {
  GLOBAL_SETTINGS_READ = 'configs.read',
  GLOBAL_SETTING_UPDATE = 'configs.write',
}
export enum MAILING_LIST {
  MAILING_LIST_READ = 'mailing.read',
  MAILING_LIST_DELETE = 'mailing.delete',
  MAILING_LIST_WRITE = 'mailing.write',
}

export enum PRICING {
  PRICING_READ = 'pricing.read',
  PRICING_WRITE = 'pricing.write',
}

export enum SCHOLARSHIP_REQUESTS {
  SCHOLARSHIP_READ = 'scholarship.read',
  SCHOLARSHIP_WRITE = 'scholarship.write',
}

export enum WORK_HOURS {
  WORK_HOURS_READ = 'work-hours.read',
  WORK_HOURS_WRITE = 'work-hours.write',
  WORK_HOURS_APPROVE = 'work-hours.approve',
  WORK_HOURS_FINANCIALS_READ = 'work-hours.financials.read',
  WORK_HOURS_APPLY = 'work-hours.apply',
}

export enum TIME_ENTRIES {
  TIME_ENTRIES_READ = 'time-entries.read',
  TIME_ENTRIES_WRITE = 'time-entries.write',
}

export enum REPORTS {
  REPORTS_READ = 'reports.read',
}

export type ADMIN =
  | USERS
  | ROLES
  | DEPARTMENTS
  | PERIODS
  | PERMISSIONS
  | GLOBAL_SETTINGS
  | MAILING_LIST
  | PRICING
  | SCHOLARSHIP_REQUESTS
  | WORK_HOURS
  | TIME_ENTRIES
  | REPORTS;
