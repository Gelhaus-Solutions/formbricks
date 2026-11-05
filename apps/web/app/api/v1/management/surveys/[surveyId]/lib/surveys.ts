import { deleteSurvey as deleteSharedSurvey } from "@/modules/survey/lib/surveys";

/** The shared delete. */
export const deleteSurvey = async (surveyId: string) => deleteSharedSurvey(surveyId);
