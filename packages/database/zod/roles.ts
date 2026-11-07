import { z } from "zod";

// The roles that can be given. The billing role went with Cloud billing (GFORMS-7): existing billing
// members keep it, but the roles endpoint no longer offers it.
export const ZRoles = z.object({
  data: z.array(z.union([z.literal("owner"), z.literal("manager"), z.literal("member")])),
});
