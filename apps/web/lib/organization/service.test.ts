import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { lookupAuthorizedOrganizationIds } from "@/lib/authorization/resource-list";
import { reconcileApiKeyRelationships } from "@/lib/authzed/api-key";
import { reconcileFeedbackDirectoryRelationships } from "@/lib/authzed/feedback-directory";
import { deleteOrganizationRelationships } from "@/lib/authzed/organization-membership";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { updateUser } from "@/lib/user/service";
import { requestEmailAuditErasureRequired } from "@/modules/email/lib/email-audit-maintenance";
import { deleteWorkspaceFilesBestEffort } from "@/modules/storage/service";
import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  getOrganizationsByUserId,
  select as organizationSelect,
  subscribeOrganizationMembersToSurveyResponses,
  updateOrganization,
} from "./service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    organization: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    organizationBilling: {
      upsert: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    workflowRun: {
      aggregate: vi.fn(),
    },
    response: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/user/service", () => ({
  updateUser: vi.fn(),
}));

vi.mock("@/lib/authorization/resource-list", () => ({ lookupAuthorizedOrganizationIds: vi.fn() }));

vi.mock("@/lib/authzed/organization-membership", () => ({
  deleteOrganizationRelationships: vi.fn(),
}));
vi.mock("@/lib/authzed/api-key", () => ({
  reconcileApiKeyRelationships: vi.fn(),
}));
vi.mock("@/lib/authzed/feedback-directory", () => ({
  reconcileFeedbackDirectoryRelationships: vi.fn(),
}));
vi.mock("@/lib/authzed/team-workspace", () => ({
  reconcileTeamWorkspaceRelationships: vi.fn(),
}));

vi.mock("@/modules/hub/service", () => ({
  deleteHubTenantData: vi.fn().mockResolvedValue({
    data: { deletedFeedbackRecords: 0, deletedEmbeddings: 0, deletedWebhooks: 0 },
    error: null,
  }),
}));

vi.mock("@/modules/storage/service", () => ({
  deleteWorkspaceFilesBestEffort: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/email/lib/email-audit-maintenance", () => ({
  requestEmailAuditErasureRequired: vi.fn().mockResolvedValue(undefined),
}));

describe("Organization Service", () => {
  beforeEach(() => {
    vi.mocked(lookupAuthorizedOrganizationIds).mockResolvedValue(["org1"]);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(prisma as never));
    vi.mocked(requestEmailAuditErasureRequired).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrganization", () => {
    test("should return organization when found", async () => {
      const mockOrganization = {
        id: "org1",
        name: "Test Org",
        createdAt: new Date(),
        updatedAt: new Date(),
        billing: {
          limits: {
            workspaces: 3,
            monthly: {
              responses: 1500,
            },
          },
          stripeCustomerId: null,
          usageCycleAnchor: new Date(),
        },
        isAISmartToolsEnabled: false,
        displayTimeZone: null,
        whitelabel: false,
      };

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization);

      const result = await getOrganization("org1");

      expect(result).toEqual(mockOrganization);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "org1" },
        select: expect.any(Object),
      });
    });

    test("should return null when organization not found", async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      const result = await getOrganization("nonexistent");

      expect(result).toBeNull();
    });

    test("should throw DatabaseError on prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.organization.findUnique).mockRejectedValue(prismaError);

      await expect(getOrganization("org1")).rejects.toThrow(DatabaseError);
    });
  });

  describe("getOrganizationsByUserId", () => {
    test("should return organizations for user", async () => {
      const mockOrganizations = [
        {
          id: "org1",
          name: "Test Org 1",
          createdAt: new Date(),
          updatedAt: new Date(),
          billing: {
            limits: {
              workspaces: 3,
              monthly: {
                responses: 1500,
              },
            },
            stripeCustomerId: null,
            usageCycleAnchor: new Date(),
          },
          isAISmartToolsEnabled: false,
          displayTimeZone: null,
          whitelabel: false,
        },
      ];

      vi.mocked(prisma.organization.findMany).mockResolvedValue(mockOrganizations);

      const result = await getOrganizationsByUserId("user1");

      expect(result).toEqual(mockOrganizations);
      expect(prisma.organization.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["org1"] },
        },
        select: expect.any(Object),
      });
    });

    test("should throw DatabaseError on prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.organization.findMany).mockRejectedValue(prismaError);

      await expect(getOrganizationsByUserId("user1")).rejects.toThrow(DatabaseError);
    });
  });

  describe("createOrganization", () => {
    test("should create organization with default billing settings", async () => {
      const expectedBilling = {
        limits: {
          workspaces: IS_FORMBRICKS_CLOUD ? 1 : 3,
          monthly: {
            responses: IS_FORMBRICKS_CLOUD ? 250 : 1500,
          },
        },
        stripeCustomerId: null,
        usageCycleAnchor: null,
      };

      const mockOrganization = {
        id: "org1",
        name: "Test Org",
        createdAt: new Date(),
        updatedAt: new Date(),
        billing: expectedBilling,
        isAISmartToolsEnabled: false,
        displayTimeZone: null,
        whitelabel: false,
      };

      vi.mocked(prisma.organization.create).mockResolvedValue(mockOrganization);

      const result = await createOrganization({ name: "Test Org" });

      expect(result).toEqual(mockOrganization);
      expect(prisma.organization.create).toHaveBeenCalledWith({
        data: {
          name: "Test Org",
          billing: {
            create: {
              limits: {
                workspaces: IS_FORMBRICKS_CLOUD ? 1 : 3,
                monthly: {
                  responses: IS_FORMBRICKS_CLOUD ? 250 : 1500,
                  workflowRuns: null,
                },
              },
              stripeCustomerId: null,
              usageCycleAnchor: null,
            },
          },
        },
        select: organizationSelect,
      });
      expect(logger.warn).toHaveBeenCalledWith(
        {
          securityEvent: "organization.created",
          organizationId: "org1",
        },
        "Organization created"
      );
    });

    test("should throw DatabaseError on prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.organization.create).mockRejectedValue(prismaError);

      await expect(createOrganization({ name: "Test Org" })).rejects.toThrow(DatabaseError);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("updateOrganization", () => {
    test("should update organization and revalidate cache", async () => {
      const mockOrganization = {
        id: "org1",
        name: "Updated Org",
        createdAt: new Date(),
        updatedAt: new Date(),
        billing: {
          limits: {
            workspaces: 3,
            monthly: {
              responses: 1500,
            },
          },
          stripeCustomerId: null,
          usageCycleAnchor: new Date(),
        },
        isAISmartToolsEnabled: false,
        displayTimeZone: null,
        whitelabel: false,
        memberships: [{ userId: "user1" }, { userId: "user2" }],
        workspaces: [
          {
            environments: [{ id: "env1" }, { id: "env2" }],
          },
        ],
      };

      vi.mocked(prisma.organization.update).mockResolvedValue(mockOrganization);
      vi.mocked(prisma.$transaction).mockImplementation(
        async (fn: any) =>
          await fn({
            organization: {
              update: prisma.organization.update,
              findUnique: vi.fn().mockResolvedValue(mockOrganization),
            },
            organizationBilling: {
              upsert: prisma.organizationBilling.upsert,
            },
          })
      );

      const result = await updateOrganization("org1", { name: "Updated Org" });

      expect(result).toMatchObject({
        id: "org1",
        name: "Updated Org",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        billing: {
          limits: {
            workspaces: 3,
            monthly: {
              responses: 1500,
            },
          },
          stripeCustomerId: null,
          usageCycleAnchor: expect.any(Date),
        },
        isAISmartToolsEnabled: false,
        whitelabel: false,
      });
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "org1" },
        data: { name: "Updated Org" },
      });
    });

    test("should throw ResourceNotFoundError when the update targets a missing organization (P2025)", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Record to update not found", {
        code: "P2025",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.$transaction).mockImplementation(
        async (fn: any) =>
          await fn({
            organization: {
              update: vi.fn().mockRejectedValue(prismaError),
              findUnique: vi.fn().mockResolvedValue({ id: "org1" }),
            },
            organizationBilling: {
              upsert: prisma.organizationBilling.upsert,
            },
          })
      );

      await expect(updateOrganization("org1", { name: "Updated Org" })).rejects.toThrow(
        ResourceNotFoundError
      );
    });
  });

  describe("subscribeOrganizationMembersToSurveyResponses", () => {
    test("should subscribe user to survey responses when not unsubscribed", async () => {
      const mockUser = {
        id: "user-123",
        notificationSettings: {
          alert: { "existing-survey-id": true },
          unsubscribedOrganizationIds: [], // User is subscribed to all organizations
        },
      } as any;

      const surveyId = "survey-123";
      const userId = "user-123";
      const organizationId = "org-123";

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);
      vi.mocked(updateUser).mockResolvedValueOnce({} as any);

      await subscribeOrganizationMembersToSurveyResponses(surveyId, userId, organizationId);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(updateUser).toHaveBeenCalledWith(userId, {
        notificationSettings: {
          alert: {
            "existing-survey-id": true,
            "survey-123": true,
          },

          unsubscribedOrganizationIds: [],
        },
      });
    });

    test("should not subscribe user when unsubscribed from organization", async () => {
      const mockUser = {
        id: "user-123",
        notificationSettings: {
          alert: { "existing-survey-id": true },
          unsubscribedOrganizationIds: ["org-123"], // User has unsubscribed from this organization
        },
      } as any;

      const surveyId = "survey-123";
      const userId = "user-123";
      const organizationId = "org-123";

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);

      await subscribeOrganizationMembersToSurveyResponses(surveyId, userId, organizationId);

      // Should not call updateUser because user is unsubscribed from this organization
      expect(updateUser).not.toHaveBeenCalled();
    });
  });

  describe("deleteOrganization", () => {
    test("does not delete the organization when the audit erasure request fails", async () => {
      vi.mocked(requestEmailAuditErasureRequired).mockRejectedValueOnce(new Error("audit store unavailable"));

      await expect(deleteOrganization("org1")).rejects.toThrow("audit store unavailable");
      expect(prisma.organization.delete).not.toHaveBeenCalled();
    });

    test("reconciles the deleted organization's AuthZed relationships", async () => {
      vi.mocked(prisma.organization.delete).mockResolvedValue({
        id: "org1",
        name: "Test Org",
        billing: { stripeCustomerId: "cus_123" },
        memberships: [],
        workspaces: [],
        teams: [],
        apiKeys: [{ id: "api-key-1" }],
        feedbackDirectories: [],
      } as any);

      await deleteOrganization("org1");

      expect(deleteOrganizationRelationships).toHaveBeenCalledWith("org1");
      expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({ teamIds: [], workspaceIds: [] });
      expect(reconcileApiKeyRelationships).toHaveBeenCalledWith({
        apiKeyIds: ["api-key-1"],
      });
    });

    test("should purge Hub-owned data for each feedback directory", async () => {
      const { deleteHubTenantData } = await import("@/modules/hub/service");
      vi.mocked(prisma.organization.delete).mockResolvedValue({
        id: "org1",
        name: "Test Org",
        billing: null,
        memberships: [],
        workspaces: [{ id: "workspace-1" }],
        teams: [{ id: "team-1" }],
        apiKeys: [{ id: "api-key-1" }, { id: "api-key-2" }],
        feedbackDirectories: [
          { id: "frd_1", workspaces: [{ workspaceId: "workspace-1" }] },
          { id: "frd_2", workspaces: [] },
        ],
      } as any);

      await deleteOrganization("org1");

      expect(deleteHubTenantData).toHaveBeenCalledTimes(2);
      expect(deleteHubTenantData).toHaveBeenCalledWith("frd_1");
      expect(deleteHubTenantData).toHaveBeenCalledWith("frd_2");
      expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({
        teamIds: ["team-1"],
        workspaceIds: ["workspace-1"],
      });
      expect(reconcileApiKeyRelationships).toHaveBeenCalledWith({
        apiKeyIds: ["api-key-1", "api-key-2"],
      });
      expect(reconcileFeedbackDirectoryRelationships).toHaveBeenCalledWith({
        assignments: [{ feedbackDirectoryId: "frd_1", workspaceId: "workspace-1" }],
        feedbackDirectoryIds: ["frd_1", "frd_2"],
      });
    });

    // ENG-3197: the cascade wipes the workspace rows, so anything left in the bucket afterwards is
    // unreferenced respondent data that nothing can enumerate. Both prefixes have to be captured
    // off the deleted rows, which is why the delete selects legacyEnvironmentId.
    test("should delete object storage files for every workspace it owned", async () => {
      vi.mocked(prisma.organization.delete).mockResolvedValue({
        id: "org1",
        name: "Test Org",
        billing: null,
        memberships: [],
        workspaces: [
          { id: "workspace-1", legacyEnvironmentId: "env-1" },
          { id: "workspace-2", legacyEnvironmentId: null },
        ],
        teams: [],
        apiKeys: [],
        feedbackDirectories: [],
      } as any);

      await deleteOrganization("org1");

      expect(deleteWorkspaceFilesBestEffort).toHaveBeenCalledTimes(2);
      expect(deleteWorkspaceFilesBestEffort).toHaveBeenCalledWith({
        id: "workspace-1",
        legacyEnvironmentId: "env-1",
      });
      expect(deleteWorkspaceFilesBestEffort).toHaveBeenCalledWith({
        id: "workspace-2",
        legacyEnvironmentId: null,
      });
    });

    test("should select legacyEnvironmentId off the deleted workspace rows", async () => {
      vi.mocked(prisma.organization.delete).mockResolvedValue({
        id: "org1",
        name: "Test Org",
        billing: null,
        memberships: [],
        workspaces: [],
        teams: [],
        apiKeys: [],
        feedbackDirectories: [],
      } as any);

      await deleteOrganization("org1");

      expect(prisma.organization.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            workspaces: { select: { id: true, legacyEnvironmentId: true } },
          }),
        })
      );
    });

    test("should complete without storage cleanup when the organization has no workspaces", async () => {
      vi.mocked(prisma.organization.delete).mockResolvedValue({
        id: "org1",
        name: "Test Org",
        billing: null,
        memberships: [],
        workspaces: [],
        teams: [],
        apiKeys: [],
        feedbackDirectories: [],
      } as any);

      await expect(deleteOrganization("org1")).resolves.toBeUndefined();

      expect(deleteWorkspaceFilesBestEffort).not.toHaveBeenCalled();
    });
  });
});
