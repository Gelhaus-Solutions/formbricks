# Image assembly and promotion

Next's standalone server, manifests, static assets and public files are assembled in
one build step. `next-runtime.json` records the deployment identity, build variant
and file hashes. The image build checks referenced assets before export and checks
the inventory again after copying it into the runtime image.
The inventory covers application output and public assets. Traced dependency packages
are completed by the Dockerfile's existing Prisma/logger overlays and checked separately
by its runtime dependency audit. Relative dependency symlinks are preserved during assembly.

CI supplies `FORMBRICKS_DEPLOYMENT_ID` as a Docker build argument derived from the
source revision, resolved version, registry variant and build profile (Sentry enabled and
PostHog configuration). Workflow run IDs and credential rotations do not invalidate normal
builds. `FORMBRICKS_BUILD_VARIANT`
records the registry the build was made for (GHCR in GForms). These are public build inputs,
not runtime configuration or secrets. Local Docker builds need neither argument;
they receive a local identity during compilation. Do not override deployment identity
when starting an already-built image.

Release and edge workflows build AMD64 and ARM64 candidates on GitHub's native hosted runners
(`ubuntu-24.04` and `ubuntu-24.04-arm`) and assemble their index under run-specific tags in
`ghcr.io/gelhaus-solutions/gforms`. Candidates have the package's normal visibility. Version,
`latest`, `edge` and branch tags are assigned only after validation.

After validation, `skopeo copy --all --preserve-digests` applies the explicit release
tags within that same repository. The workflow checks every destination against the
tested index digest and signs the image.

**Do not delete GHCR package versions to clean up candidate tags.** GHCR deletes
the whole version (digest), not just the selected tag. A `candidate-*`
tag can share its digest with a published version, `latest`, or a branch alias;
deleting that package version removes those release tags too. Check every tag on
the digest before any cleanup, and preserve released images and their signatures.

Candidate tags are retained for diagnosis and retries; this workflow does not
remove them or configure expiry. Retention changes need to protect every released
digest, including architecture manifests referenced by a published index.

## Build-provider credentials

Native release builds run on GitHub-hosted runners with a `packages: write` token for
GHCR, plus the Sentry upload token when configured. These credentials are not limited
to candidate tags; they can also update release or deployment tags. The workflow
gates normal promotion, but those gates are not an IAM restriction on the builder.
Preparation receives only a Sentry-presence flag; the actual token is used by
the build job. PR validation uses public disposable fixtures and no publish credentials.

## Native candidate validation

Separate AMD64 and ARM64 jobs validate the exact index digest in parallel on matching native
runners. They do not install QEMU or pull different architectures into the same Docker image
store. Promotion depends on both jobs succeeding. Browser assertions and actions have bounded
60-second timeouts, and the complete validation job has a 20-minute budget. Failed checks
remain blocking; rerunning a failed validation job reuses the built digest without rebuilding. The smoke test uses
disposable PostgreSQL and Redis containers, runs migrations, seeds a non-authenticating
user fixture so the instance selects login instead of setup, loads `/`, verifies
login hydration and navigates to password recovery. It rejects missing scripts,
styles and uncaught browser errors. It does not validate authorization, survey
submission, Hub/Cube integration or the Kubernetes handoff.

## Rerun validation

Install dependencies and Chromium using the repository-pinned pnpm/Playwright versions:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm --dir docker test __tests__/next-runtime.test.ts __tests__/image-promotion.test.ts
bash docker/smoke-release-image.sh REPOSITORY@sha256:DIGEST BUILD_IDENTITY ecr linux/amd64
bash docker/smoke-release-image.sh REPOSITORY@sha256:DIGEST BUILD_IDENTITY ecr linux/arm64
```

Run each command on the matching native architecture (CI enforces this). The script creates its own
isolated datastores; it does not accept application database credentials. Cleanup runs
on success and failure. To inspect an image without starting the application:

```sh
docker run --rm --network none --entrypoint node REPOSITORY@sha256:DIGEST \
  verify-next-runtime.mjs BUILD_IDENTITY ecr
```

Assertion failures report their specific reason and affected file paths, without actual/expected
configuration values. Unexpected errors, including malformed JSON, retain a generic diagnostic.

## CA trust

The runtime is the official Node binary from `node:24-alpine3.24`. It trusts the root CA list compiled
into it, so a CA distrust or an OpenSSL fix reaches Node with a Node release: rebuild on the current
base image. Alpine's `ca-certificates` and OpenSSL packages are still pinned for the rest of the image.

`NODE_EXTRA_CA_CERTS` adds a private CA on top of Node's list. To make Node follow the OS bundle
instead, a deployment sets `NODE_OPTIONS=--use-openssl-ca` together with
`SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt`; a `NODE_OPTIONS` of its own must keep that flag.

## Repair and recovery

Use `rebuild_application: true` on **Deploy Selected Branch to Apollo** or
**Build Cloud Deployment Images** to bypass the installer and runner caches.
Dependency-download caches remain reusable. Only this explicit repair mode
adds a run/attempt nonce to the deployment identity. Ordinary reruns retain the identity and
can reuse the complete application artifact. This builds, validates
and promotes a new candidate; it does not modify the existing image.

For cache regression testing, build community then cloud variants with the same source,
repeat with warm caches, and run the same verifier/browser checks on each digest. Include
the release Sentry configuration, since PR builds intentionally omit upload credentials.

Failed candidate validation leaves deployment tags unchanged. Keep its digest and failed-check
output for diagnosis, then rerun validation of that digest while it remains available
under the registry's existing retention settings. GHCR pulls use the workflow's package
permissions. If an image has been removed,
start a new build and validate its digest. Use the explicit repair option when the
application needs to be rebuilt.

Registry writes to multiple tags are not transactional. A failure after promotion begins
can leave only some tags updated, including a tag already consumed by a deployment controller.
Inspect every intended tag's current digest and resume promotion of the same verified digest.
Do not automatically restore previous tag values or roll back workloads: a deployment may
already have crossed the upgrade's forward-recovery boundary. Keep the promotion job's
verified candidate digest when recovering; rebuilding creates a different candidate that
must pass validation again.

Do not patch manifests or
rename chunks inside running pods. For a 6.1 repair, preserve the deployed migration
and authorization state; reverting the image to 6.0 requires separately establishing
that the upgrade has not crossed its forward-recovery boundary.

After deployment, verify each pod's digest and public browser journeys. An image smoke
test does not prove ingress draining, mixed-version compatibility or zero downtime.
