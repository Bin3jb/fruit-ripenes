-- ---------------------------------------------------------------------------
-- AI Fruit Ripeness Recognizer — MySQL schema
-- ---------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS fruit_ripeness
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fruit_ripeness;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('user','admin') NOT NULL DEFAULT 'user',
  language      ENUM('en','ar')      NOT NULL DEFAULT 'en',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS scans (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  user_id           INT NOT NULL,
  original_filename VARCHAR(255),
  stored_filename   VARCHAR(255),
  annotated_url     VARCHAR(512),
  detection_count   INT NOT NULL DEFAULT 0,
  inference_ms      DECIMAL(8,1),
  model_name        VARCHAR(80),
  language          ENUM('en','ar') NOT NULL DEFAULT 'en',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_scans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_scans_user_time (user_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS detections (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  scan_id             INT NOT NULL,
  fruit               VARCHAR(32) NOT NULL,
  stage               ENUM('unripe','ripe','overripe') NOT NULL,
  stage_from_detector ENUM('unripe','ripe','overripe') NOT NULL,
  stage_refined       TINYINT(1) NOT NULL DEFAULT 0,
  confidence          DECIMAL(5,4) NOT NULL,
  recommended_action  ENUM('eat','ripen','cook','discard') NOT NULL,
  days_room           INT,
  days_fridge         INT,
  advice              TEXT,
  box_x1 INT, box_y1 INT, box_x2 INT, box_y2 INT,
  color_cues          JSON,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_det_scan FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE,
  INDEX idx_det_fruit_stage (fruit, stage)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  scan_id    INT NULL,
  role       ENUM('user','assistant') NOT NULL,
  content    TEXT NOT NULL,
  source     VARCHAR(60),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msg_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_scan FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE SET NULL,
  INDEX idx_msg_thread (user_id, scan_id, id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS feedback (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  detection_id    INT NULL,
  message         TEXT,
  rating          TINYINT,
  corrected_stage ENUM('unripe','ripe','overripe') NULL,
  reviewed        TINYINT(1) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fb_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fb_det  FOREIGN KEY (detection_id) REFERENCES detections(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_log (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NULL,
  action     VARCHAR(60) NOT NULL,
  detail     VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Waste-avoidance view: how many scanned fruits were caught while still edible.
CREATE OR REPLACE VIEW v_rescue_rate AS
SELECT s.user_id,
       SUM(d.stage = 'overripe') AS overripe,
       SUM(d.stage = 'ripe')     AS ripe,
       SUM(d.stage = 'unripe')   AS unripe,
       COUNT(*)                  AS total
FROM detections d JOIN scans s ON s.id = d.scan_id
GROUP BY s.user_id;
