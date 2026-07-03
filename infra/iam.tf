data "tls_certificate" "eks_oidc" {
  url = module.eks.cluster_oidc_issuer_url
}

locals {
  oidc_provider_url = replace(module.eks.cluster_oidc_issuer_url, "https://", "")

  ebs_csi_namespace       = "kube-system"
  ebs_csi_service_account = "ebs-csi-controller-sa"

  ack_rds_namespace       = "ack-system"
  ack_rds_service_account = "ack-rds-controller"
}

# --- EBS CSI driver IRSA -----------------------------------------------

data "aws_iam_policy_document" "ebs_csi_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [module.eks.oidc_provider_arn]
    }

    # Trust is scoped to the exact namespace/service-account pair the EBS
    # CSI controller runs as, not the whole OIDC provider, so no other
    # workload on the cluster can assume this role via IRSA.
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_provider_url}:sub"
      values   = ["system:serviceaccount:${local.ebs_csi_namespace}:${local.ebs_csi_service_account}"]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_provider_url}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ebs_csi" {
  name               = "${var.cluster_name}-ebs-csi-irsa"
  assume_role_policy = data.aws_iam_policy_document.ebs_csi_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "ebs_csi" {
  role       = aws_iam_role.ebs_csi.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
}

# --- ACK RDS controller IRSA -------------------------------------------

data "aws_iam_policy_document" "ack_rds_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [module.eks.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_provider_url}:sub"
      values   = ["system:serviceaccount:${local.ack_rds_namespace}:${local.ack_rds_service_account}"]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_provider_url}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

# Scoped to the RDS actions the ACK RDS controller actually needs to
# reconcile DBInstance/DBSubnetGroup/DBParameterGroup CRs (playbooks
# elsewhere provision the Java monolith's database via this controller).
# Avoids "rds:*" so a compromised controller can't touch unrelated
# account-wide RDS settings (e.g. global cluster ops, reserved instances).
data "aws_iam_policy_document" "ack_rds" {
  statement {
    effect = "Allow"
    actions = [
      "rds:CreateDBInstance",
      "rds:DeleteDBInstance",
      "rds:ModifyDBInstance",
      "rds:DescribeDBInstances",
      "rds:CreateDBSubnetGroup",
      "rds:DeleteDBSubnetGroup",
      "rds:ModifyDBSubnetGroup",
      "rds:DescribeDBSubnetGroups",
      "rds:CreateDBParameterGroup",
      "rds:DeleteDBParameterGroup",
      "rds:ModifyDBParameterGroup",
      "rds:DescribeDBParameterGroups",
      "rds:ModifyDBParameterGroup",
      "rds:AddTagsToResource",
      "rds:ListTagsForResource",
      "rds:RemoveTagsFromResource",
      "rds:DescribeDBSnapshots",
      "rds:CreateDBSnapshot",
    ]
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeSubnets",
      "ec2:DescribeVpcs",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "ack_rds" {
  name        = "${var.cluster_name}-ack-rds-controller"
  description = "Least-privilege policy for the ACK RDS controller running on the ${var.cluster_name} hub cluster"
  policy      = data.aws_iam_policy_document.ack_rds.json
  tags        = var.tags
}

resource "aws_iam_role" "ack_rds" {
  name               = "${var.cluster_name}-ack-rds-irsa"
  assume_role_policy = data.aws_iam_policy_document.ack_rds_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "ack_rds" {
  role       = aws_iam_role.ack_rds.name
  policy_arn = aws_iam_policy.ack_rds.arn
}
