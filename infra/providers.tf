provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "app-mod-factory"
      Layer     = "infra-hub"
      ManagedBy = "terraform"
    }
  }
}

# Configured against the hub cluster so downstream resources in this same
# state (or modules that consume these providers) can reach the API server
# for post-provisioning steps. The platform-engine layer runs its own
# Terraform/Argo CD workflow against this same cluster for Argo CD, ACK,
# External Secrets and Kyverno installs.
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name, "--region", var.region]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name, "--region", var.region]
    }
  }
}
