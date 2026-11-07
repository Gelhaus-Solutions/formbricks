// GForms sells no plans (GFORMS-7), so follow-ups are open to every organization. The getter stays for
// its call sites and for an upstream merge that adds one.
export const getSurveyFollowUpsPermission = async (_organizationId: string): Promise<boolean> => true;
