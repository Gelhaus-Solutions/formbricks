import { load } from "js-yaml";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const workflowsDirectory = ".github/workflows";
const formbricksReleaseWorkflow = `${workflowsDirectory}/formbricks-release.yml`;
const helmReleaseWorkflow = `${workflowsDirectory}/release-helm-chart.yml`;
const edgeWorkflow = `${workflowsDirectory}/release-docker-edge.yml`;
const releaseWorkflows = [formbricksReleaseWorkflow, helmReleaseWorkflow, edgeWorkflow];
const releasedVersion = "${{ needs.docker-build-community.outputs.VERSION }}";

type WorkflowStep = {
  env?: Record<string, string>;
  id?: string;
  if?: string;
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, string>;
};

type WorkflowInput = {
  description?: string;
  required?: boolean;
  type?: string;
};

type WorkflowTriggers = {
  push?: { branches?: string[]; paths?: string[] };
  workflow_call?: { inputs?: Record<string, WorkflowInput> };
  workflow_dispatch?: { inputs?: Record<string, WorkflowInput> } | null;
};

type WorkflowJob = {
  if?: string;
  needs?: string[] | string;
  outputs?: Record<string, string>;
  steps?: WorkflowStep[];
  uses?: string;
  with?: Record<string, string | boolean>;
};

type Workflow = {
  concurrency?: { group?: string; "cancel-in-progress"?: boolean };
  jobs?: Record<string, WorkflowJob | undefined>;
  on?: WorkflowTriggers;
  // js-yaml 3 resolved the YAML 1.1 truthy key `on:` to boolean `true`; 4.x keeps it a string.
  true?: WorkflowTriggers;
};

const readText = (relativePath: string): string => readFileSync(join(repositoryRoot, relativePath), "utf8");

const readWorkflow = (relativePath: string): Workflow => load(readText(relativePath)) as Workflow;

describe("release workflows", () => {
  test.each(releaseWorkflows)("%s parses as YAML and declares jobs", (path) => {
    expect(Object.keys(readWorkflow(path).jobs ?? {})).not.toHaveLength(0);
  });

  // GForms runs on GitHub's hosted runners and publishes to GHCR only (decision D7): no Formbricks
  // Cloud ECR push, no Linear release tracking, no Helm app-version PR through a GitHub App.
  test("releases only through GHCR, the Helm chart and the stable tag", () => {
    expect(Object.keys(readWorkflow(formbricksReleaseWorkflow).jobs ?? {}).sort()).toEqual([
      "check-cube-image",
      "check-latest-release",
      "docker-build-community",
      "helm-chart-release",
      "move-stable-tag",
      "scan-community-image",
    ]);
  });

  test("references no Linear action, AWS credential or Blacksmith runner in any workflow", () => {
    const directory = join(repositoryRoot, workflowsDirectory);
    const offenders = readdirSync(directory)
      .filter((entry) => entry.endsWith(".yml") || entry.endsWith(".yaml"))
      .filter((entry) => entry !== "docker-build-validation.yml")
      .filter((entry) =>
        /linear\/linear-release-action|aws-actions\/|AWS_ECR_PUSH_ROLE_ARN|blacksmith-\d+vcpu/.test(
          readFileSync(join(directory, entry), "utf8")
        )
      );

    expect(offenders).toEqual([]);
  });

  // is_latest promotes GHCR :latest and the stable tag. The script is what fails closed on an API
  // error, so the decision has to go through it and nowhere else.
  test("decides latest-release promotion only through the fail-closed script", () => {
    const jobs = readWorkflow(formbricksReleaseWorkflow).jobs;
    const steps = jobs?.["check-latest-release"]?.steps ?? [];
    const decide = steps.find((step) => step.id === "compare_tags");
    const promote = "${{ needs.check-latest-release.outputs.is_latest == 'true' }}";

    expect(jobs?.["check-latest-release"]?.outputs?.is_latest).toBe(
      "${{ steps.compare_tags.outputs.is_latest }}"
    );
    expect(decide?.run).toBe("bash .github/scripts/resolve-latest-release.sh");
    // The tag reaches the script through env; interpolated into a run body it would be shell input.
    expect(decide?.env?.CURRENT_TAG).toBe("${{ github.event.release.tag_name }}");
    expect(steps.filter((step) => step.run?.includes("${{"))).toEqual([]);
    // A prerelease is never promoted, so an API outage must not block one: it skips the lookup.
    const scriptCheckout = steps.find((step) => step.name === "Checkout the release scripts");
    expect(scriptCheckout?.uses).toMatch(/^actions\/checkout@/);
    expect(scriptCheckout?.if).toBe("${{ !github.event.release.prerelease }}");
    expect(decide?.if).toBe("${{ !github.event.release.prerelease }}");

    expect(jobs?.["docker-build-community"]?.with?.MAKE_LATEST).toBe(promote);
    expect(jobs?.["move-stable-tag"]?.with?.make_latest).toBe(promote);
  });

  test("scans the GForms image by the digest the release built", () => {
    const scan = readWorkflow(formbricksReleaseWorkflow).jobs?.["scan-community-image"];

    expect(scan?.with?.image_ref).toBe(
      "ghcr.io/gelhaus-solutions/gforms@${{ needs.docker-build-community.outputs.IMAGE_DIGEST }}"
    );
  });

  test("can publish a chart patch without inventing a new application image", () => {
    const workflow = readWorkflow(helmReleaseWorkflow);
    const triggers = workflow.on ?? workflow.true;
    const reusableInputs = triggers?.workflow_call?.inputs;
    const manualInputs = triggers?.workflow_dispatch?.inputs;
    const steps = workflow.jobs?.publish?.steps ?? [];
    const updateStep = steps.find((step) => step.name === "Update Chart.yaml with new version");
    const imageStep = steps.find((step) => step.name === "Validate default GForms image tag");
    const pushStep = steps.find((step) => step.name === "Push Helm chart to GitHub Container Registry");

    expect(reusableInputs?.VERSION?.required).toBe(true);
    expect(reusableInputs?.APP_VERSION?.required).toBe(true);
    expect(manualInputs?.VERSION?.required).toBe(true);
    expect(manualInputs?.APP_VERSION?.required).toBe(true);
    expect(updateStep?.run).toContain('yq -i ".version = \\"${VERSION}\\""');
    expect(updateStep?.run).toContain('yq -i ".appVersion = \\"${APP_VERSION}\\""');
    expect(imageStep?.run).toContain('expected_image="ghcr.io/gelhaus-solutions/gforms:${APP_VERSION}"');
    expect(pushStep?.run).toContain("oci://ghcr.io/gelhaus-solutions/helm-charts");

    expect(readWorkflow(formbricksReleaseWorkflow).jobs?.["helm-chart-release"]?.with).toMatchObject({
      APP_VERSION: releasedVersion,
      VERSION: releasedVersion,
    });
  });
});

describe("edge image", () => {
  test("builds from main only and never cancels a run halfway through promotion", () => {
    const workflow = readWorkflow(edgeWorkflow);
    const triggers = workflow.on ?? workflow.true;

    expect(triggers?.push?.branches).toEqual(["main"]);
    expect(workflow.jobs?.build?.if).toBe("github.ref == 'refs/heads/main'");
    expect(workflow.jobs?.build?.with).toMatchObject({
      registry_type: "ghcr",
      ghcr_image_name: "gelhaus-solutions/gforms",
      experimental_mode: true,
    });
    expect(workflow.concurrency).toEqual({ group: "edge-image", "cancel-in-progress": false });
  });

  test("adds the edge tag to the validated candidate's tags", () => {
    const promote = readWorkflow(edgeWorkflow).jobs?.promote;
    const tagStep = promote?.steps?.find((step) => step.id === "tags");
    const promoteStep = promote?.steps?.find((step) => step.uses?.endsWith("/promote-verified-image"));
    const directory = mkdtempSync(join(tmpdir(), "edge-tags-"));
    const output = join(directory, "output");
    try {
      const result = spawnSync("/bin/bash", ["-c", tagStep!.run!], {
        encoding: "utf8",
        env: {
          PATH: process.env.PATH,
          GITHUB_OUTPUT: output,
          TAGS: "ghcr.io/gelhaus-solutions/gforms:main\nghcr.io/gelhaus-solutions/gforms:0.0.0-alpha-main-1\n",
        },
      });

      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(output, "utf8")).toBe(
        "tags<<EOF\nghcr.io/gelhaus-solutions/gforms:main\nghcr.io/gelhaus-solutions/gforms:0.0.0-alpha-main-1\nghcr.io/gelhaus-solutions/gforms:edge\nEOF\n"
      );
      expect(promoteStep?.with?.release_tags).toBe("${{ steps.tags.outputs.tags }}");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
