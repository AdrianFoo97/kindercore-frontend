import { apiFetch } from './client.js';

/** A post on everyone's Home (first kind: a new child enrols — class and start date only). */
export interface SchoolNewsPost { id: string; kind: 'ENROLMENT'; title: string; body: string; postedAt: string }

export const SCHOOL_NEWS_KEY = ['school-news'];
/** Settings → Students → School news: posting new enrolments on or off (on unless switched off). */
export const ENROLMENT_NEWS_SETTING = 'school_news_enrolments';

export function fetchSchoolNews() {
  return apiFetch<SchoolNewsPost[]>('/api/school-news');
}

export function hideSchoolNews(id: string) {
  return apiFetch<{ ok: true }>(`/api/school-news/${encodeURIComponent(id)}/hide`, { method: 'POST' });
}
