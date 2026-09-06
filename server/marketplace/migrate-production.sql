-- Aditiva e reaplicável em MariaDB. Não altera cadastros nem outros bancos.
USE `u214656250_appgamesusados`;
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS suspended TINYINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS moderation_status ENUM('visible','hidden') NOT NULL DEFAULT 'visible';
ALTER TABLE products ADD COLUMN IF NOT EXISTS moderation_reason VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS request_key VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_request ON products(seller_customer_id,request_key);
ALTER TABLE product_reports ADD COLUMN IF NOT EXISTS resolved_at DATETIME(6) NULL;
ALTER TABLE product_reports ADD COLUMN IF NOT EXISTS resolution VARCHAR(500) NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS marketplace_blocks (
  blocker_id BIGINT UNSIGNED NOT NULL,
  blocked_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (blocker_id,blocked_id), KEY ix_blocks_reverse(blocked_id,blocker_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS marketplace_notices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL,
  message VARCHAR(500) NOT NULL,
  order_code CHAR(20) NULL,
  read_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_notices_customer(customer_id,id)
) ENGINE=InnoDB;
