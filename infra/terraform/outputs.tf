output "backend_url" {
  description = "The URL of the backend Cloud Run service"
  value       = google_cloud_run_v2_service.backend.uri
}

output "frontend_url" {
  description = "The URL of the frontend Cloud Run service"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "database_connection_name" {
  description = "The connection name for Cloud SQL (used by Cloud SQL Proxy)"
  value       = google_sql_database_instance.postgres.connection_name
}

output "database_private_ip" {
  description = "The private IP address of the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.private_ip_address
  sensitive   = true
}

output "redis_host" {
  description = "The hostname of the Memorystore Redis instance"
  value       = google_redis_instance.main.host
}

output "redis_port" {
  description = "The port of the Memorystore Redis instance"
  value       = google_redis_instance.main.port
}

output "gcs_bucket_name" {
  description = "The name of the GCS bucket for exports"
  value       = google_storage_bucket.exports.name
}

output "vpc_connector_name" {
  description = "The name of the VPC access connector"
  value       = google_vpc_access_connector.connector.name
}

output "backend_service_account" {
  description = "The email of the backend service account"
  value       = google_service_account.backend.email
}
