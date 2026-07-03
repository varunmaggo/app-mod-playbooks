# java-heavy Playbook

Stamps out a legacy Java monolith onto the hub EKS cluster with its own
dedicated Amazon RDS (Postgres) database, provisioned declaratively via ACK.

## What this automates

1. **Build** — multi-stage `Dockerfile` (Maven build stage, slim JRE runtime
   stage, non-root user, container healthcheck).
2. **Runtime** — Deployment + Service, running as a non-root user with a
   read-only root filesystem.
3. **Identity** — an IRSA-annotated ServiceAccount so the app (and ESO) can
   assume an AWS IAM role scoped to this app's secrets.
4. **Secrets** — an External Secrets Operator `SecretStore` + `ExternalSecret`
   that pulls DB master credentials from AWS Secrets Manager into a native
   k8s Secret the app consumes via `envFrom`.
5. **Database** — an ACK `rds.services.k8s.aws/v1alpha1` `DBSubnetGroup` +
   `DBInstance` that provisions a dedicated RDS Postgres instance sized by
   Backstage-supplied parameters (`dbInstanceClass`, `dbStorageGb`).
6. **Environments** — Kustomize overlays for `dev`, `staging`, `prod` that
   patch replica count and RDS sizing/HA settings per environment.

## Guardrail: Playbook Encapsulation

This playbook must contain everything needed for this concern. There are no
manual steps after a developer triggers it from Backstage: Argo CD picks up
the stamped-out `apps/<appName>/` directory and reconciles the Deployment,
Service, ESO resources, and ACK RDS resources together — the database is
provisioned as part of the same GitOps sync, not a side-channel `aws rds
create-db-instance` call.

## Layout

```
skeleton/
  Dockerfile
  apps/${{ values.appName }}/
    base/
      deployment.yaml
      service.yaml
      serviceaccount.yaml       # IRSA-annotated
      secretstore.yaml          # ESO -> AWS Secrets Manager
      external-secret.yaml      # DB creds -> k8s Secret
      rds-subnetgroup.yaml      # ACK DBSubnetGroup
      rds-instance.yaml         # ACK DBInstance
      kustomization.yaml
    overlays/
      dev/kustomization.yaml
      staging/kustomization.yaml
      prod/kustomization.yaml
```

See `playbook.yaml` for the full parameter list the Backstage template must
prompt for.
