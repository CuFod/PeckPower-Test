-- PeakPower 啄食动力：MySQL 8.0+ 数据库初始化脚本

CREATE DATABASE IF NOT EXISTS peakpower
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE peakpower;

-- 用户账户：所有学习进度、待办及番茄钟记录均通过 user_id 关联此表。
-- password_hash 仅保存后端使用 bcrypt 或 Argon2 生成的密码哈希，绝不可保存明文密码。
CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(255) NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB COMMENT='用户账户表';

CREATE TABLE exam_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL COMMENT '如：高考、四级、六级、雅思、托福',
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_exam_types_name (name),
  KEY idx_exam_types_sort_order (sort_order)
) ENGINE=InnoDB COMMENT='英语考试类型';

INSERT INTO exam_types (name, sort_order) VALUES
  ('高考', 1), ('四级', 2), ('六级', 3), ('雅思', 4), ('托福', 5);

CREATE TABLE vocabulary (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  exam_type_id BIGINT UNSIGNED NOT NULL,
  word VARCHAR(100) NOT NULL,
  phonetic VARCHAR(255) NULL,
  meaning TEXT NOT NULL,
  example_sentence TEXT NULL,
  difficulty TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '难度：1-5',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_vocabulary_exam_word (exam_type_id, word),
  KEY idx_vocabulary_exam_difficulty (exam_type_id, difficulty),
  CONSTRAINT chk_vocabulary_difficulty CHECK (difficulty BETWEEN 1 AND 5),
  CONSTRAINT fk_vocabulary_exam_type FOREIGN KEY (exam_type_id)
    REFERENCES exam_types(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='英语单词库';

CREATE TABLE user_word_progress (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  vocabulary_id BIGINT UNSIGNED NOT NULL,
  status ENUM('new', 'learning', 'review', 'mastered', 'difficult') NOT NULL DEFAULT 'new',
  next_review_date DATETIME NULL COMMENT '下次复习时间',
  review_count INT UNSIGNED NOT NULL DEFAULT 0,
  correct_count INT UNSIGNED NOT NULL DEFAULT 0,
  wrong_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_word_progress_user_word (user_id, vocabulary_id),
  KEY idx_user_word_progress_user_review (user_id, next_review_date),
  KEY idx_user_word_progress_user_status (user_id, status),
  CONSTRAINT fk_user_word_progress_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_user_word_progress_vocabulary FOREIGN KEY (vocabulary_id)
    REFERENCES vocabulary(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='用户单词学习进度';

CREATE TABLE questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  exam_type_id BIGINT UNSIGNED NOT NULL,
  question_type ENUM('listening', 'reading', 'writing', 'speaking', 'translation') NOT NULL,
  stem TEXT NOT NULL COMMENT '题干',
  options JSON NULL COMMENT '选项',
  answer TEXT NULL COMMENT '答案或参考答案',
  analysis TEXT NULL COMMENT '题目解析',
  difficulty TINYINT UNSIGNED NULL COMMENT '难度：1-5',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_questions_exam_type_type (exam_type_id, question_type),
  KEY idx_questions_exam_type_difficulty (exam_type_id, difficulty),
  CONSTRAINT chk_questions_difficulty CHECK (difficulty IS NULL OR difficulty BETWEEN 1 AND 5),
  CONSTRAINT fk_questions_exam_type FOREIGN KEY (exam_type_id)
    REFERENCES exam_types(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='英语真题题库';

CREATE TABLE todos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  priority TINYINT UNSIGNED NOT NULL DEFAULT 2 COMMENT '1高 / 2中 / 3低',
  due_date DATETIME NULL,
  is_completed TINYINT(1) NOT NULL DEFAULT 0,
  estimated_pomodoros INT UNSIGNED NOT NULL DEFAULT 1,
  actual_pomodoros INT UNSIGNED NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_todos_user_completed_due (user_id, is_completed, due_date),
  KEY idx_todos_user_priority (user_id, priority),
  CONSTRAINT chk_todos_priority CHECK (priority IN (1, 2, 3)),
  CONSTRAINT fk_todos_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='用户待办任务';

CREATE TABLE pomodoro_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  todo_task_id BIGINT UNSIGNED NULL COMMENT '可为空：允许自由专注',
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NULL,
  status ENUM('completed', 'interrupted') NOT NULL DEFAULT 'completed',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pomodoro_user_start_time (user_id, start_time),
  KEY idx_pomodoro_user_todo (user_id, todo_task_id),
  CONSTRAINT chk_pomodoro_duration CHECK (duration_minutes > 0),
  CONSTRAINT fk_pomodoro_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_pomodoro_todo FOREIGN KEY (todo_task_id)
    REFERENCES todos(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='番茄钟专注记录';
