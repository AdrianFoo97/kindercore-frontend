import {
  faClipboardCheck, faListCheck, faBookOpen, faRoad, faShieldHalved,
  faUtensils, faBroom, faBoxOpen, faPersonWalking, faDoorOpen,
  faTruck, faScrewdriverWrench, faFirstAid, faTriangleExclamation, faBell,
  faFileLines, faGear, faCheckDouble, faUsers, faChalkboard,
  faChild, faPhone, faEnvelope, faClock, faLightbulb,
  faStar, faCamera, faLock, faClipboardList, faHandHoldingHeart,
  faCalendarDays, faMoneyBillWave, faBus, faBed, faPuzzlePiece,
  faPalette, faMusic, faBook, faGraduationCap, faUserShield,
  faBoxesStacked, faTrash, faFire, faDroplet, faHandSparkles,
  faTemperatureHalf, faSyringe, faBaby, faHouse, faKey,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

// FA icon names admin can pick from. Must match the controller's allow-list.
export const ALLOWED_SOP_ICONS = [
  'faClipboardCheck', 'faListCheck', 'faBookOpen', 'faRoad', 'faShieldHalved',
  'faUtensils', 'faBroom', 'faBoxOpen', 'faPersonWalking', 'faDoorOpen',
  'faTruck', 'faScrewdriverWrench', 'faFirstAid', 'faTriangleExclamation', 'faBell',
  'faFileLines', 'faGear', 'faCheckDouble', 'faUsers', 'faChalkboard',
  'faChild', 'faPhone', 'faEnvelope', 'faClock', 'faLightbulb',
  'faStar', 'faCamera', 'faLock', 'faClipboardList', 'faHandHoldingHeart',
  'faCalendarDays', 'faMoneyBillWave', 'faBus', 'faBed', 'faPuzzlePiece',
  'faPalette', 'faMusic', 'faBook', 'faGraduationCap', 'faUserShield',
  'faBoxesStacked', 'faTrash', 'faFire', 'faDroplet', 'faHandSparkles',
  'faTemperatureHalf', 'faSyringe', 'faBaby', 'faHouse', 'faKey',
] as const;

// Resolves the FA icon name string admin saved to the actual icon object.
// Falls back to the default when the name is unknown (e.g. a legacy row).
const ICON_MAP: Record<string, IconDefinition> = {
  faClipboardCheck, faListCheck, faBookOpen, faRoad, faShieldHalved,
  faUtensils, faBroom, faBoxOpen, faPersonWalking, faDoorOpen,
  faTruck, faScrewdriverWrench, faFirstAid, faTriangleExclamation, faBell,
  faFileLines, faGear, faCheckDouble, faUsers, faChalkboard,
  faChild, faPhone, faEnvelope, faClock, faLightbulb,
  faStar, faCamera, faLock, faClipboardList, faHandHoldingHeart,
  faCalendarDays, faMoneyBillWave, faBus, faBed, faPuzzlePiece,
  faPalette, faMusic, faBook, faGraduationCap, faUserShield,
  faBoxesStacked, faTrash, faFire, faDroplet, faHandSparkles,
  faTemperatureHalf, faSyringe, faBaby, faHouse, faKey,
};

export function resolveSopIcon(name: string): IconDefinition {
  return ICON_MAP[name] ?? faClipboardCheck;
}
