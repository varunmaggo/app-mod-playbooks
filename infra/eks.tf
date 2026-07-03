module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.31"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access = true

  # Module manages this internally; we still create our own OIDC-scoped
  # IAM roles in iam.tf for controllers this layer is responsible for
  # (EBS CSI, ACK RDS) rather than relying on the module's addon presets.
  enable_irsa = true

  eks_managed_node_groups = {
    general = {
      min_size       = var.node_group_min_size
      max_size       = var.node_group_max_size
      desired_size   = var.node_group_desired_size
      instance_types = var.node_instance_types
      capacity_type  = "ON_DEMAND"
      disk_size      = var.node_disk_size

      labels = {
        role = "general"
      }
    }
  }

  tags = var.tags
}

# EBS CSI addon depends on the IRSA role in iam.tf being available before
# the addon can assume it via the pod-identity/service-account annotation.
resource "aws_eks_addon" "ebs_csi" {
  cluster_name             = module.eks.cluster_name
  addon_name               = "aws-ebs-csi-driver"
  service_account_role_arn = aws_iam_role.ebs_csi.arn
  resolve_conflicts_on_update = "OVERWRITE"

  depends_on = [module.eks]
}
