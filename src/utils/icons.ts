/**
 * Centralized re-exports of the `react-icons/io5` icons used across pages.
 *
 * Why this exists: pages were importing 10–20 icons each and adding new ones
 * meant editing per-page imports. Re-exporting from a single module gives one
 * source of truth without breaking tree-shaking — Rollup/Vite drops the unused
 * named re-exports at build time.
 *
 * Add icons here as pages need them; do not `export *`.
 */
export {
  IoAdd,
  IoBarbell,
  IoCalendar,
  IoCalendarOutline,
  IoCart,
  IoCartOutline,
  IoCheckbox,
  IoCheckboxOutline,
  IoCheckmarkCircle,
  IoChevronBack,
  IoChevronForward,
  IoClipboard,
  IoClipboardOutline,
  IoClose,
  IoCode,
  IoContract,
  IoDocumentText,
  IoDocumentTextOutline,
  IoDownloadOutline,
  IoEllipseOutline,
  IoExpand,
  IoFitness,
  IoFitnessOutline,
  IoHeart,
  IoHeartOutline,
  IoImage,
  IoLink,
  IoList,
  IoLogOutOutline,
  IoLogoYoutube,
  IoPencil,
  IoPeople,
  IoPersonAdd,
  IoPersonOutline,
  IoPlay,
  IoRefreshOutline,
  IoRemove,
  IoReorderTwo,
  IoRepeat,
  IoRestaurant,
  IoRestaurantOutline,
  IoSearchOutline,
  IoSendOutline,
  IoSettings,
  IoSettingsOutline,
  IoShareSocial,
  IoShareSocialOutline,
  IoTime,
  IoTrash,
  IoTrophy,
} from 'react-icons/io5';
