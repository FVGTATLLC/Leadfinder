terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "salespilot-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# --------------------------------------------------------------------------
# Networking — VPC & Serverless VPC Connector
# --------------------------------------------------------------------------

resource "google_compute_network" "main" {
  name                    = "salespilot-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "main" {
  name          = "salespilot-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.main.id
}

resource "google_vpc_access_connector" "connector" {
  name          = "salespilot-vpc-connector"
  region        = var.region
  network       = google_compute_network.main.name
  ip_cidr_range = "10.8.0.0/28"
  min_instances = 2
  max_instances = 3
  machine_type  = "f1-micro"
}

# --------------------------------------------------------------------------
# Cloud SQL — PostgreSQL
# --------------------------------------------------------------------------

resource "google_sql_database_instance" "postgres" {
  name             = "salespilot-postgres"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier              = "db-f1-micro"
    availability_type = "ZONAL"
    disk_size         = 10
    disk_type         = "PD_SSD"

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
    }

    maintenance_window {
      day  = 7
      hour = 4
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }

  deletion_protection = true

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

resource "google_sql_database" "salespilot" {
  name     = "salespilot"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "salespilot" {
  name     = "salespilot"
  instance = google_sql_database_instance.postgres.name
  password = var.database_password
}

# Private services access for Cloud SQL
resource "google_compute_global_address" "private_ip_range" {
  name          = "salespilot-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# --------------------------------------------------------------------------
# Memorystore — Redis
# --------------------------------------------------------------------------

resource "google_redis_instance" "main" {
  name               = "salespilot-redis"
  tier               = "BASIC"
  memory_size_gb     = 1
  region             = var.region
  redis_version      = "REDIS_7_0"
  authorized_network = google_compute_network.main.id

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

# --------------------------------------------------------------------------
# GCS Bucket — Exports
# --------------------------------------------------------------------------

resource "google_storage_bucket" "exports" {
  name          = "${var.project_id}-salespilot-exports"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

# --------------------------------------------------------------------------
# Cloud Run — Backend
# --------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "backend" {
  name     = "salespilot-backend"
  location = var.region

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "gcr.io/${var.project_id}/salespilot-backend:latest"

      ports {
        container_port = 8000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "DATABASE_URL"
        value = "postgresql+asyncpg://salespilot:${var.database_password}@${google_sql_database_instance.postgres.private_ip_address}:5432/salespilot"
      }

      env {
        name  = "REDIS_URL"
        value = "redis://${google_redis_instance.main.host}:${google_redis_instance.main.port}/0"
      }

      env {
        name  = "JWT_SECRET"
        value = var.jwt_secret
      }

      env {
        name  = "GCS_BUCKET"
        value = google_storage_bucket.exports.name
      }

      env {
        name  = "CORS_ORIGINS"
        value = "https://${google_cloud_run_v2_service.frontend.uri}"
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8000
        }
        initial_delay_seconds = 10
        period_seconds        = 5
        failure_threshold     = 10
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8000
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    service_account = google_service_account.backend.email
  }

  depends_on = [
    google_sql_database.salespilot,
    google_redis_instance.main,
  ]
}

# --------------------------------------------------------------------------
# Cloud Run — Frontend
# --------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "frontend" {
  name     = "salespilot-frontend"
  location = var.region

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }

    containers {
      image = "gcr.io/${var.project_id}/salespilot-frontend:latest"

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "HOSTNAME"
        value = "0.0.0.0"
      }

      startup_probe {
        tcp_socket {
          port = 3000
        }
        initial_delay_seconds = 10
        period_seconds        = 5
        failure_threshold     = 10
      }
    }
  }
}

# --------------------------------------------------------------------------
# IAM — Service Accounts & Bindings
# --------------------------------------------------------------------------

resource "google_service_account" "backend" {
  account_id   = "salespilot-backend-sa"
  display_name = "SalesPilot Backend Service Account"
}

resource "google_project_iam_member" "backend_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_project_iam_member" "backend_storage_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_project_iam_member" "backend_redis_editor" {
  project = var.project_id
  role    = "roles/redis.editor"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

# Allow unauthenticated access to Cloud Run services
resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
