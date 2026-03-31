mysqldump: [Warning] Using a password on the command line interface can be insecure.
-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: yaksok
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `doctor_notes`
--

DROP TABLE IF EXISTS `doctor_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctor_notes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `original_text` longtext COLLATE utf8mb4_unicode_ci COMMENT 'Whisper 변환 원문',
  `summary` json DEFAULT NULL COMMENT 'GPT 요약 결과',
  `visit_date` date DEFAULT NULL COMMENT '진료 날짜',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `doctor_notes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor_notes`
--

LOCK TABLES `doctor_notes` WRITE;
/*!40000 ALTER TABLE `doctor_notes` DISABLE KEYS */;
INSERT INTO `doctor_notes` VALUES (1,1,'점사 결과를 확인해보니 환자분은 급성 장염 증상이 있습니다. 최근에 자극적인 음식이나 상한 음식을 섭취했을 가능성이 있습니다. 다행히 심각한 상태는 아니지만 며칠 동안 장을 쉬게 해주는 관리가 필요합니다. 오늘은 지사제와 장염 완화제, 수분 보충을 돕는 약을 처방해드리겠습니다. 약은 하루 3원, 식후 30분에 복용하시면 됩니다. 당분간 기름진 음식, 매운 음식, 카페인 음료, 유제품은 드시지 않는 것이 좋습니다. 대신 죽이나 미음처럼 소화가 잘 되는 음식 위주로 식사하는 것을 권장드립니다. 증상 결과를 확인하기 위해 3일 뒤에 다시 병원에 방문해주세요. 만약 그 전에 고열이나 심한 탈수 증상이 나타나면 바로 병원으로 오셔야 합니다. 약은 꾸준히 복용하시고 충분한 휴식을 취하시길 바랍니다.','{\"summary\": \"급성 장염 증상으로 약을 처방받고, 식사에 주의하며 3일 뒤에 재방문해야 합니다.\", \"diagnosis\": \"환자분은 급성 장염 증상이 있습니다. 최근에 자극적인 음식이나 상한 음식을 먹었을 가능성이 있습니다.\", \"next_visit\": \"3일 뒤\", \"medications\": [{\"name\": \"지사제, 장염 완화제, 수분 보충 약\", \"caution\": \"고열이나 심한 탈수 증상이 나타나면 바로 병원에 가세요.\", \"schedule\": \"하루 3회, 식후 30분\"}], \"precautions\": [\"기름진 음식, 매운 음식, 카페인 음료, 유제품은 피하세요.\", \"죽이나 미음처럼 소화가 잘 되는 음식 위주로 드세요.\"]}',NULL,'2026-03-30 19:32:53');
/*!40000 ALTER TABLE `doctor_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medicine_schedules`
--

DROP TABLE IF EXISTS `medicine_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medicine_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `note_id` int DEFAULT NULL COMMENT '진료 기록 연결 (선택)',
  `medicine_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '약 이름',
  `morning` tinyint(1) DEFAULT '0' COMMENT '아침',
  `afternoon` tinyint(1) DEFAULT '0' COMMENT '점심',
  `evening` tinyint(1) DEFAULT '0' COMMENT '저녁',
  `bedtime` tinyint(1) DEFAULT '0' COMMENT '취침 전',
  `schedule_text` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '원본 복용 일정 텍스트',
  `caution` text COLLATE utf8mb4_unicode_ci COMMENT '주의사항',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '활성 여부',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `note_id` (`note_id`),
  CONSTRAINT `medicine_schedules_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `medicine_schedules_ibfk_2` FOREIGN KEY (`note_id`) REFERENCES `doctor_notes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medicine_schedules`
--

LOCK TABLES `medicine_schedules` WRITE;
/*!40000 ALTER TABLE `medicine_schedules` DISABLE KEYS */;
INSERT INTO `medicine_schedules` VALUES (1,1,1,'지사제, 장염 완화제, 수분 보충 약',1,1,1,0,'하루 3회, 식후 30분','고열이나 심한 탈수 증상이 나타나면 바로 병원에 가세요.',1,'2026-03-30 20:04:33','2026-03-30 20:04:33');
/*!40000 ALTER TABLE `medicine_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medicine_searches`
--

DROP TABLE IF EXISTS `medicine_searches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medicine_searches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `input_text` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 입력 (증상/상태)',
  `recommendations` json DEFAULT NULL COMMENT 'AI 추천 약 목록',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `medicine_searches_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medicine_searches`
--

LOCK TABLES `medicine_searches` WRITE;
/*!40000 ALTER TABLE `medicine_searches` DISABLE KEYS */;
INSERT INTO `medicine_searches` VALUES (1,1,'어지러워','[{\"name\": \"메클리진\", \"caution\": \"졸음이 올 수 있으니 운전이나 기계 조작 시 주의하세요.\", \"efficacy\": \"어지러움을 줄여주는 약입니다. 특히 멀미나 귀에서 오는 어지러움에 효과적입니다.\", \"how_to_take\": \"하루 1~2회, 식사 전에 복용하세요.\"}, {\"name\": \"진통제 (타이레놀)\", \"caution\": \"간에 부담을 줄 수 있으니, 과다 복용하지 않도록 주의하세요.\", \"efficacy\": \"두통이나 긴장으로 인한 어지러움을 완화해줍니다.\", \"how_to_take\": \"하루 3~4회, 식후에 복용하세요.\"}, {\"name\": \"구역구토약 (온단세트론)\", \"caution\": \"심한 두통이나 어지러움이 계속되면 의사와 상담하세요.\", \"efficacy\": \"구역질과 함께 오는 어지러움을 줄여줍니다.\", \"how_to_take\": \"하루 1~2회, 필요할 때 복용하세요.\"}]','2026-03-30 16:52:03'),(2,1,'근육통','[{\"name\": \"타이레놀\", \"caution\": \"간에 문제가 있는 분은 사용을 피해야 합니다.\", \"efficacy\": \"근육통을 완화하고 통증을 줄여줍니다.\", \"how_to_take\": \"하루 3~4회, 1회 1~2정씩 복용합니다. 식사 후에 복용하는 것이 좋습니다.\"}, {\"name\": \"이부프로펜\", \"caution\": \"위장에 문제가 있는 분은 주의해야 합니다.\", \"efficacy\": \"염증과 통증을 줄여주는 약입니다.\", \"how_to_take\": \"하루 3번, 1회 200~400mg을 식사 후에 복용합니다.\"}, {\"name\": \"파스\", \"caution\": \"상처가 있는 곳에는 사용하지 마세요.\", \"efficacy\": \"근육통 부위에 붙여서 통증을 완화합니다.\", \"how_to_take\": \"아픈 부위에 붙이고, 필요할 때 교체합니다.\"}]','2026-03-30 16:52:35'),(3,1,'근육통','[{\"name\": \"타이레놀\", \"caution\": \"간에 문제가 있는 분은 사용 전 의사와 상담하세요.\", \"efficacy\": \"근육통을 완화해주는 약입니다. 통증을 줄여줍니다.\", \"how_to_take\": \"하루 3~4회, 1회 1~2정을 식후에 복용하세요.\"}, {\"name\": \"이부프로펜\", \"caution\": \"위장에 문제가 있는 분은 주의해야 합니다.\", \"efficacy\": \"근육통과 염증을 줄여주는 약입니다. 통증을 완화합니다.\", \"how_to_take\": \"하루 3회, 1회 200~400mg을 식후에 복용하세요.\"}, {\"name\": \"파스\", \"caution\": \"상처가 있는 부위에는 사용하지 마세요.\", \"efficacy\": \"근육통 부위에 붙여서 통증을 완화해주는 약입니다.\", \"how_to_take\": \"아픈 부위에 붙이고, 필요시 하루에 1~2회 교체하세요.\"}]','2026-03-31 20:23:38');
/*!40000 ALTER TABLE `medicine_searches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `symptoms`
--

DROP TABLE IF EXISTS `symptoms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `symptoms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `symptom_text` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '입력한 증상',
  `possible_diseases` json DEFAULT NULL COMMENT 'AI 분석 결과 질병 목록',
  `is_emergency` tinyint(1) DEFAULT '0' COMMENT '응급 상황 여부',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `symptoms_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `symptoms`
--

LOCK TABLES `symptoms` WRITE;
/*!40000 ALTER TABLE `symptoms` DISABLE KEYS */;
INSERT INTO `symptoms` VALUES (1,1,'가슴이 아프고 숨이 차요','[{\"name\": \"심장병\", \"reason\": \"가슴 통증과 숨 가쁨은 심장에 문제가 있을 수 있다는 신호입니다.\"}, {\"name\": \"폐렴\", \"reason\": \"폐렴은 폐에 염증이 생겨 숨이 차고 가슴이 아플 수 있습니다.\"}, {\"name\": \"심장마비\", \"reason\": \"가슴 통증과 숨이 차는 것은 심장마비의 증상일 수 있어 매우 위험합니다.\"}]',1,'2026-03-30 07:09:15');
/*!40000 ALTER TABLE `symptoms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kakao_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '카카오 고유 ID',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '카카오 이메일',
  `nickname` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '카카오 닉네임',
  `profile_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '카카오 프로필 이미지 URL',
  `name` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '실제 이름',
  `age` int DEFAULT NULL COMMENT '나이',
  `gender` enum('male','female','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '성별',
  `address` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '주소',
  `guardian_email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '보호자 이메일',
  `is_registered` tinyint(1) DEFAULT '0' COMMENT '추가 정보 입력 완료 여부',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kakao_id` (`kakao_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'4817313094',NULL,NULL,NULL,'홍길동',68,'male','서울시 강남구 테헤란로 123',NULL,1,'2026-03-27 19:12:17','2026-03-27 19:22:58');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'yaksok'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-31 20:45:49
