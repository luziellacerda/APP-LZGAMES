CREATE DATABASE IF NOT EXISTS `u214656250_appgamesusados`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `u214656250_appgamesusados`;

CREATE TABLE IF NOT EXISTS marketplace_profiles (
  customer_id BIGINT UNSIGNED NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (customer_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  seller_customer_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(80) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  category VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  item_condition VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  price_cents BIGINT UNSIGNED NOT NULL,
  city VARCHAR(80) NOT NULL,
  state CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status ENUM('active','paused','reserved','sold','closed') NOT NULL DEFAULT 'active',
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_public_id (public_id),
  KEY ix_products_catalog (status, id),
  KEY ix_products_seller (seller_customer_id, id),
  KEY ix_products_category (category, status, id),
  CONSTRAINT fk_products_profile FOREIGN KEY (seller_customer_id)
    REFERENCES marketplace_profiles(customer_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_media (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('image','video') NOT NULL,
  storage_name VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  poster_name VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NULL,
  position TINYINT UNSIGNED NOT NULL,
  width SMALLINT UNSIGNED NULL,
  height SMALLINT UNSIGNED NULL,
  duration_ms INT UNSIGNED NULL,
  bytes BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_media_position (product_id, position),
  UNIQUE KEY uq_product_media_storage (storage_name),
  CONSTRAINT fk_media_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_code CHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  buyer_customer_id BIGINT UNSIGNED NOT NULL,
  seller_customer_id BIGINT UNSIGNED NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  status ENUM('requested','accepted','rejected','cancelled','completed') NOT NULL DEFAULT 'requested',
  expires_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchase_public_code (public_code),
  KEY ix_purchase_buyer (buyer_customer_id, id),
  KEY ix_purchase_seller (seller_customer_id, id),
  KEY ix_purchase_product (product_id, status),
  KEY ix_purchase_expiry (status, expires_at),
  CONSTRAINT fk_purchase_product FOREIGN KEY (product_id)
    REFERENCES products(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  reporter_customer_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  details VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_reporter (product_id, reporter_customer_id),
  KEY ix_reports_created (created_at),
  CONSTRAINT fk_report_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS marketplace_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_customer_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  resource_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  resource_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  metadata_json JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY ix_audit_actor (actor_customer_id, id),
  KEY ix_audit_resource (resource_type, resource_id)
) ENGINE=InnoDB;
