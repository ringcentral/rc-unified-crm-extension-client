// Tracks that the user chose "Do not connect a CRM" on the platform selection page.
// While set (and no CRM is selected), the automatic platform selection page on login is skipped.
// The "Select CRM" button in settings still works because it does not consult this flag.
const NO_CRM_CHOSEN_KEY = 'noCrmChosen';

// Hidden fields of the "App Connect No CRM" Google Form, prefilled with the RingCentral identity.
const NO_CRM_SURVEY_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfUcyZtneMBlCTw2sXlm8LQOZmUeX6lHZEyMKQSOfib_O-QNg/viewform';
const NO_CRM_SURVEY_ACCOUNT_ID_ENTRY = 'entry.1862074204';
const NO_CRM_SURVEY_EXTENSION_ID_ENTRY = 'entry.23574002';

export const NO_CRM_PLATFORM_ID = 'none';
export const NO_CRM_ITEM_CONST = `${NO_CRM_PLATFORM_ID}=skip`;

export async function getNoCrmChosen(): Promise<boolean> {
  const stored = await chrome.storage.local.get({ [NO_CRM_CHOSEN_KEY]: false });
  return stored[NO_CRM_CHOSEN_KEY] === true;
}

export async function setNoCrmChosen(): Promise<void> {
  await chrome.storage.local.set({ [NO_CRM_CHOSEN_KEY]: true });
}

export async function clearNoCrmChosen(): Promise<void> {
  await chrome.storage.local.remove(NO_CRM_CHOSEN_KEY);
}

export function getNoCrmSurveyUrl({ rcAccountId, rcExtensionId }: { rcAccountId?: string | number | null; rcExtensionId?: string | number | null }): string {
  const url = new URL(NO_CRM_SURVEY_FORM_URL);
  url.searchParams.set(NO_CRM_SURVEY_ACCOUNT_ID_ENTRY, String(rcAccountId ?? ''));
  url.searchParams.set(NO_CRM_SURVEY_EXTENSION_ID_ENTRY, String(rcExtensionId ?? ''));
  return url.toString();
}

const noCrmService = {
  getNoCrmChosen,
  setNoCrmChosen,
  clearNoCrmChosen,
  getNoCrmSurveyUrl,
};

export default noCrmService;
