import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBolt, faBroom, faChair, faDoorOpen, faFaucetDrip, faShieldHalved, faSnowflake, faWrench,
} from '@fortawesome/free-solid-svg-icons';
import type { FacilityCategory, FacilityStatus } from '../../api/facilityIssues.js';

// How facility issues look — icon per kind of problem, colour per status.

export const CATEGORY_ICON: Record<FacilityCategory, IconDefinition> = {
  DOOR_WINDOW: faDoorOpen,
  PLUMBING: faFaucetDrip,
  ELECTRICAL: faBolt,
  AIRCON: faSnowflake,
  FURNITURE: faChair,
  SAFETY: faShieldHalved,
  CLEANING: faBroom,
  OTHER: faWrench,
};

export const STATUS_LOOK: Record<FacilityStatus, { fg: string; bg: string }> = {
  OPEN: { fg: '#b91c1c', bg: '#fef2f2' },
  IN_PROGRESS: { fg: '#b45309', bg: '#fffbeb' },
  RESOLVED: { fg: '#047857', bg: '#ecfdf5' },
};

export const URGENT_LOOK = { fg: '#ffffff', bg: '#dc2626' };
