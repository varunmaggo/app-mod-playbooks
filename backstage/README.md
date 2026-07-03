# Backstage — The Playbook UI

This directory is the **only trigger mechanism** for the Application
Modernization Factory. Everything downstream of it — the Git commit, the
Argo CD sync, the RDS instance, the Keycloak client, the blue-green
rollout — is automated. Backstage's job is narrow and deliberate: turn a
handful of developer-supplied parameters into a pull request against this
repo, in the exact directory shape that `platform-engine`'s ApplicationSet
is watching (see `platform-engine/CONVENTIONS.md`).

There is no other supported entry point. Developers do not write Kustomize,
touch Terraform, run `aws rds create-db-instance`, or `kubectl apply`
anything by hand. If a task can't be expressed as "fill in this form and
submit," it belongs in a playbook or the platform engine, not in a
developer's terminal.

## What lives here

- `templates/java-heavy-monolith/template.yaml` — scaffolds the
  `java-heavy` playbook: a Spring Boot workload plus a dedicated
  ACK-provisioned RDS PostgreSQL instance.
- `templates/dotnet-legacy-api/template.yaml` — scaffolds the `dotnet-api`
  playbook: a .NET API with Argo Rollouts blue-green delivery and a
  Keycloak OIDC client registration.
- `catalog-info.yaml` — registers both templates (and this repo itself) in
  the Backstage software catalog so they're discoverable from the "Create"
  page.

## The developer flow

1. Open Backstage, go to **Create**, and pick either
   "Modernize a Java Monolith onto EKS with a dedicated RDS database" or
   "Modernize a Legacy .NET API onto EKS with Blue-Green Rollouts."
2. Fill in the form: app name, namespace, target environments, and the
   playbook-specific parameters (database size/storage for Java; OIDC
   redirect URI and Keycloak realm for .NET), plus the owning team.
3. Submit. The scaffolder fetches the matching playbook skeleton from
   `/playbooks`, renders the `${{ values.xxx }}` placeholders with your
   answers, and opens a pull request against this repo containing the new
   `playbooks/<playbook-name>/instances/<app-name>/deploy/` directory.
4. A human reviews and merges the PR — the one manual step in the whole
   flow, and it's a normal code review, not an infrastructure operation.
5. Argo CD's `playbook-instances` ApplicationSet (Git directory generator,
   see `platform-engine/argocd/applicationsets/playbook-appset.yaml`)
   notices the new directory on its next repo poll and materializes a
   matching `Application` automatically. Kyverno's cluster policies gate
   the manifests at admission time; Kargo takes over promoting the
   workload from `dev` to `staging` to `prod`.

At no point does the developer run `kubectl`, `aws`, `terraform`, or
`argocd`. The PR is the only artifact they produce.

## Running Backstage locally against this repo

This repo does not vendor a full Backstage app — only the templates and
catalog entities Backstage needs to point at. To demo it locally:

```bash
npx @backstage/create-app@latest
cd <your-new-app>
```

Then wire it up to this repo:

1. Add a `catalog.locations` entry in `app-config.yaml` pointing at this
   repo's `backstage/catalog-info.yaml` (or directly at the two
   `templates/*/template.yaml` files) — either a `file:` path if running
   against a local checkout, or a `url:` pointing at the raw GitHub path
   once this branch is pushed.
2. Make sure the following backend plugins are enabled (present by default
   in `@backstage/create-app` scaffolds, but confirm they're wired into
   `packages/backend`):
   - `@backstage/plugin-scaffolder-backend` — executes `template.yaml`
     (`fetch:template`, `publish:github:pull-request`, `catalog:register`).
   - `@backstage/plugin-catalog-backend` — ingests `catalog-info.yaml` and
     the templates so they appear under **Create**.
   - The GitHub integration (`integrations.github` in `app-config.yaml`,
     backed by a token with repo/PR-write scope on this repository) — the
     `publish:github:pull-request` action needs this to open PRs.
3. Set the GitHub token via `GITHUB_TOKEN` (or `AUTH_GITHUB_CLIENT_ID` /
   `AUTH_GITHUB_CLIENT_SECRET` if you also want GitHub sign-in) and run:

   ```bash
   yarn start
   ```

4. Open `http://localhost:3000/create`, pick a template, and submit — the
   resulting PR lands on this repo.

For a pure demo (no live GitHub write access), swap `publish:github:pull-
request` for `publish:file` in the two `template.yaml` files to write the
scaffolded output to local disk instead of opening a PR.
