# dotnet-api Playbook

Stamps out a modernized legacy .NET API onto the hub EKS cluster with Argo
Rollouts blue-green progressive delivery and automated OIDC client
registration against the shared Keycloak realm.

## What this automates

1. **Build** — multi-stage `Dockerfile` (dotnet SDK build stage, aspnet
   runtime stage, non-root user).
2. **Progressive delivery** — an Argo Rollouts `Rollout` with
   `strategy.blueGreen`, plus `activeService` and `previewService` Services.
   The active Service always points at the current stable ReplicaSet; the
   preview Service exposes the new ReplicaSet so it can be smoke-tested
   before the cutover is promoted.
3. **Centralized auth** — a `KeycloakClient` CRD (Keycloak Operator) that
   registers this API as an OIDC client in the shared realm, an
   `ExternalSecret` that republishes the Operator-generated client secret
   under the name the app expects, and a `NetworkPolicy` restricting egress
   to the Keycloak namespace and DNS.
4. **Environments** — Kustomize overlays for `dev`, `staging`, `prod` that
   patch replica count and blue-green promotion behavior: dev/staging
   auto-promote; prod requires a manual promotion gate
   (`autoPromotionEnabled: false`).

## Guardrail: Playbook Encapsulation

This playbook must contain everything needed for this concern. There are no
manual steps after a developer triggers it from Backstage: Argo CD picks up
the stamped-out `apps/<appName>/` directory and reconciles the Rollout,
Services, and Keycloak client registration together. Promoting a prod
rollout after review is done via `kubectl argo rollouts promote` or the Argo
CD/Rollouts UI — not by re-running any provisioning step.

## Layout

```
skeleton/
  Dockerfile
  apps/${{ values.appName }}/
    base/
      serviceaccount.yaml
      rollout.yaml              # Argo Rollouts blue-green
      active-service.yaml
      preview-service.yaml
      keycloak-client.yaml      # Keycloak Operator KeycloakClient CRD
      oidc-client-secret.yaml   # ExternalSecret republishing client secret
      networkpolicy.yaml
      kustomization.yaml
    overlays/
      dev/kustomization.yaml        # auto-promote
      staging/kustomization.yaml    # auto-promote
      prod/kustomization.yaml       # manual promotion gate
```

See `playbook.yaml` for the full parameter list the Backstage template must
prompt for.
