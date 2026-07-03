output "cluster_name" {
  description = "Name of the EKS hub cluster"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "API server endpoint of the EKS hub cluster"
  value       = module.eks.cluster_endpoint
}

output "cluster_oidc_provider_arn" {
  description = "ARN of the IAM OIDC provider for the hub cluster, needed to create further IRSA roles (Argo CD, Kyverno, External Secrets)"
  value       = module.eks.oidc_provider_arn
}

output "vpc_id" {
  description = "ID of the hub VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs used by the hub cluster's node groups and internal load balancers"
  value       = module.vpc.private_subnets
}

output "ebs_csi_role_arn" {
  description = "IAM role ARN for the EBS CSI driver's IRSA service account"
  value       = aws_iam_role.ebs_csi.arn
}

output "ack_rds_role_arn" {
  description = "IAM role ARN for the ACK RDS controller's IRSA service account"
  value       = aws_iam_role.ack_rds.arn
}
