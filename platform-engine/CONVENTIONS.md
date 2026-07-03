# Playbook Instance Convention

This is the contract between Backstage (self-service scaffolding) and the
Playbook Engine (GitOps automation). **Any team/agent building Backstage
templates or playbooks MUST follow this layout.**

## Directory convention

Every time a developer scaffolds a new application from a playbook via
Backstage, the resulting instance MUST be committed to this repo at:

```
playbooks/<playbook-name>/instances/<app-name>/deploy/
```

Example, two instances of the `java-heavy` playbook and one of `dotnet-api`:

```
playbooks/
  java-heavy/
    instances/
      claims-service/
        deploy/
          base/
          overlays/
            dev/
            staging/
            prod/
      policy-service/
        deploy/
          base/
          overlays/
            dev/
            staging/
            prod/
  dotnet-api/
    instances/
      billing-api/
        deploy/
          base/
          overlays/
            dev/
            staging/
            prod/
```

- `<playbook-name>` matches the playbook directory under `/playbooks` (e.g.
  `java-heavy`, `dotnet-api`).
- `<app-name>` is the Backstage-supplied component name (kebab-case).
- `deploy/` holds the Kubernetes manifests (Kustomize base + overlays is the
  expected shape, but any valid Kustomize/plain-manifest directory that Argo
  CD can render is acceptable).
- `deploy/overlays/<env>` is what Kargo promotes between (dev -> staging ->
  prod) by updating image tags / config in that overlay path.

## Why this matters

The ApplicationSet at `platform-engine/argocd/applicationsets/playbook-appset.yaml`
uses a Git directory generator glob of:

```
playbooks/*/instances/*
```

Every directory matching that glob automatically becomes an Argo CD
`Application`. There is no manual `kubectl apply` or `argocd app create`
step — Backstage commits the scaffolded files under this path, Argo CD's
ApplicationSet controller notices the new directory on its next repo poll,
and a matching `Application` is generated and synced automatically.

If a playbook template places files anywhere else, it will silently NOT be
picked up by the platform engine.
