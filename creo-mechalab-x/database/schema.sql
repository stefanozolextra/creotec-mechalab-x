-- Create Database
CREATE DATABASE IF NOT EXISTS mechatronics_db;
USE mechatronics_db;

-- 1. USERS TABLE
-- Handles Admin & Student roles.
-- 'valid_until' enforces the 25-day expiration rule.
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Encrypted format [cite: 63]
    role ENUM('admin', 'student') NOT NULL DEFAULT 'student',
    batch_number VARCHAR(20), -- To group the 25 enrollees 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until DATETIME, -- Account creates expiration date automatically
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. PROGRESS TABLE
-- Tracks module completion and simulation scores (Levels 1-10)[cite: 54, 60].
CREATE TABLE progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    level_id INT NOT NULL, -- 1 to 10
    score INT DEFAULT 0, -- 100% or 0% based on wiring [cite: 57]
    status ENUM('locked', 'unlocked', 'completed') DEFAULT 'locked',
    completed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. TRIGGER: Auto-Set Expiry
-- Automatically sets 'valid_until' to 25 days after creation for students.
DELIMITER //
CREATE TRIGGER before_user_create
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
    IF NEW.role = 'student' THEN
        SET NEW.valid_until = DATE_ADD(NOW(), INTERVAL 25 DAY);
    END IF;
END;
//
DELIMITER ;