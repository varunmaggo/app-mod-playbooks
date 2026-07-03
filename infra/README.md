# infra — Hub Cluster Bootstrap

This directory provisions the infrastructure foundation for the Application
Modernization Factory: a VPC and an EKS "hub" control-plane cluster that
everything else in this demo (GitOps, ACK controllers, Kyverno policies,
Backstage-driven playbooks) runs on top of.

It does **not** install any Kubernetes-level platform components itself
(no Argo CD, no ACK controller manifests, no Kyverno policies). Its job
ends at: a working cluster, node capacity, an OIDC provider for IRSA, and
IAM roles that downstream controllers will assume.

## What this creates

- **VPC** (`vpc.tf`): public + private subnets across `az_count` AZs
  (default 3), a NAT gateway (single by default, demo-scale), and the
  subnet tags EKS/ELB controllers expect for auto-discovery.
- **EKS cluster** (`eks.tf`): the hub/control-plane cluster, via the
  `terraform-aws-modules/eks/aws` registry module, with IRSA enabled.
- **Managed node group** (`eks.tf`): a single general-purpose node group,
  2-4 `t3.large` nodes by default — enough to run the platform-engine
  add-ons and demo workloads, not meant for production load.
- **IRSA roles** (`iam.tf`): an IAM OIDC provider is created implicitly by
  the EKS module, plus two IAM roles scoped via OIDC trust conditions to
  specific namespace/service-account pairs:
  - EBS CSI driver role, bound to the AWS-managed
    `AmazonEBSCSIDriverPolicy`.
  - ACK RDS controller role, bound to a hand-written least-privilege
    policy limited to the RDS (and read-only EC2 networking) actions the
    ACK RDS controller needs — this is what the Java monolith
    modernization playbook uses to provision its database.
- **EBS CSI EKS addon** (`eks.tf`): installed via `aws_eks_addon`, wired to
  the IRSA role above, so pods can claim persistent volumes (needed for
  the Java monolith playbook's stateful workloads and RDS-adjacent
  tooling).

## Prerequisites

- Terraform >= 1.5
- AWS credentials with permissions to create VPCs, EKS clusters, IAM
  roles/policies, and EKS addons (this repo/sandbox does not itself have
  live AWS credentials — this layer is written to be run from an
  environment that does).
- `aws` CLI available on the machine running `terraform apply` (used by
  the `kubernetes`/`helm` provider `exec` blocks to fetch a short-lived
  cluster token).

## Usage

```bash
cd infra
terraform init
terraform apply
```

Review the plan, in particular `var.region`, `var.cluster_name`, and node
group sizing, before applying against a real account.

## Outputs

Running `terraform output` after apply exposes what other layers need to
bootstrap themselves against this cluster:

| Output                      | Used by                                              |
|------------------------------|-------------------------------------------------------|
| `cluster_name`               | `aws eks update-kubeconfig`, Argo CD/ACK install scripts |
| `cluster_endpoint`           | kubeconfig / kubernetes & helm providers in other layers |
| `cluster_oidc_provider_arn`  | creating further IRSA roles (Argo CD, Kyverno, External Secrets Operator) |
| `vpc_id`                     | any additional networking (RDS subnet groups, endpoints) |
| `private_subnet_ids`         | node groups, internal load balancers, RDS subnet groups |
| `ebs_csi_role_arn`           | reference/debugging for the EBS CSI addon's IRSA binding |
| `ack_rds_role_arn`           | annotating the ACK RDS controller's Kubernetes service account (`ack-system/ack-rds-controller`) when it's installed |

## What happens next

Once this layer has been applied, the `/platform-engine` layer takes over
and installs (via GitOps, against this same cluster):

- Argo CD, using the `kubernetes`/`helm` providers or its own bootstrap
  process pointed at `cluster_endpoint`.
- The ACK RDS controller, deployed into the `ack-system` namespace with
  its service account annotated with `ack_rds_role_arn` for IRSA.
- External Secrets Operator and Kyverno policies.

Those layers should treat this cluster and its OIDC provider as the
source of truth — additional IRSA roles they need should be created
against `cluster_oidc_provider_arn`, not by re-provisioning the cluster.
