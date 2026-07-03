# Playbook Engine

The GitOps automation and governance layer that ties the Application
Modernization Factory together. This is what actually *executes* what
Backstage triggers — nothing here is invoked by a human running kubectl.

## Components

**Argo CD** (`argocd/`)
Continuously reconciles the cluster against what's committed in git. The
`playbook-instances` ApplicationSet (`argocd/applicationsets/playbook-appset.yaml`)
uses a Git directory generator to watch `playbooks/*/instances/*`. When
Backstage scaffolds a new app instance and commits it to that path, Argo CD
automatically generates and syncs a matching `Application` — no
`argocd app create` step, ever. `argocd/applications/root-app.yaml` is an
App-of-Apps that bootstraps the ApplicationSet itself, the Kyverno
policies, and the Kargo project/warehouses/stages as Argo CD-managed
resources, so the whole platform engine is self-hosting after one initial
apply.

**Kargo** (`kargo/`)
Owns promotion between environments. A `Warehouse` per app instance
subscribes to that app's ECR repo (new image tags) and its own
`deploy/overlays/<env>` git path. `Stage` resources
(`kargo/stages.yaml`) define dev -> staging -> prod: each promotion clones
the repo, runs a health check against the previous stage (skipped for
dev), bumps the image tag in the target overlay via Kustomize, and commits
+ pushes back to git. Argo CD then picks up that commit and syncs it — the
loop closes entirely inside git, Kargo never talks to the Kubernetes API
directly to "deploy" anything. Promotion into `prod` requires manual
approval (`project.yaml` sets `autoPromotionEnabled: false` for `prod`);
dev/staging auto-promote.

**Kyverno** (`kyverno/policies/`)
Admission-time guardrails applied to every workload the playbooks
generate, regardless of which playbook or team produced it:
- `require-resource-limits.yaml` — CPU/memory requests+limits (Audit — see
  in-file rationale on why this one isn't blocking yet).
- `disallow-privileged.yaml` — no privileged containers, no privilege
  escalation (Enforce).
- `require-non-root.yaml` — `runAsNonRoot: true` required (Enforce).
- `require-image-signature-or-registry.yaml` — images must come from the
  factory's approved ECR registry (Enforce).
- `require-external-secrets-not-plaintext.yaml` — blocks raw `Secret`
  manifests with inline `data`/`stringData`, forcing use of External
  Secrets Operator (Enforce; exempts Secrets ESO itself creates).

## Directory convention playbook instances must follow

```
playbooks/<playbook-name>/instances/<app-name>/deploy/
```

See `CONVENTIONS.md` for the full contract (this is what Backstage
templates and the `java-heavy` / `dotnet-api` playbooks must emit into).
Anything committed outside this path is invisible to the ApplicationSet.

## No manual kubectl/aws CLI after bootstrap

Once Argo CD is Helm-installed (`argocd/install/`) and `root-app.yaml` is
applied one time, every subsequent action in the factory — provisioning a
new app instance, promoting a build to staging, rolling back a bad
release — happens via a git commit (made by Backstage on scaffold, or by
Kargo during promotion). Argo CD reconciles the resulting state into the
cluster; Kyverno validates it at admission time. No engineer or platform
operator runs `kubectl apply`, `argocd app sync`, or `aws` CLI commands as
part of normal operation.
