CREATE TABLE `announcement_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`announcement_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `annread_uq` ON `announcement_reads` (`announcement_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`link` text,
	`file_id` text,
	`created_by_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by_id` text
);
--> statement-breakpoint
CREATE INDEX `announcements_created_idx` ON `announcements` (`created_at`);--> statement-breakpoint
CREATE TABLE `assignment_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`completed_at` integer,
	`created_by_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignment_folders_number_unique` ON `assignment_folders` (`number`);--> statement-breakpoint
CREATE TABLE `assignment_items` (
	`id` text PRIMARY KEY NOT NULL,
	`folder_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`title` text NOT NULL,
	`instructions` text,
	`deadline` integer,
	`required_files_note` text,
	`created_by_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`folder_id`) REFERENCES `assignment_folders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assign_folder_subject_uq` ON `assignment_items` (`folder_id`,`subject_id`);--> statement-breakpoint
CREATE TABLE `assignment_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`uploader_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`file_id` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`verified_by_id` text,
	`verified_at` integer,
	`note` text,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`item_id`) REFERENCES `assignment_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignment_resources_file_id_unique` ON `assignment_resources` (`file_id`);--> statement-breakpoint
CREATE INDEX `ares_item_status_idx` ON `assignment_resources` (`item_id`,`status`);--> statement-breakpoint
CREATE TABLE `assignment_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`marked_by_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `assignment_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sub_item_user_uq` ON `assignment_submissions` (`item_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `sub_user_idx` ON `assignment_submissions` (`user_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`actor_role` text,
	`actor_name` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`metadata` text,
	`ip` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_type` text NOT NULL,
	`thread_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text,
	`file_id` text,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by_id` text,
	`delete_note` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chat_thread_idx` ON `chat_messages` (`thread_type`,`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `chat_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`reported_by_id` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`resolved_by_id` text,
	`resolved_at` integer,
	`resolution_note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reports_status_idx` ON `chat_reports` (`status`);--> statement-breakpoint
CREATE TABLE `clearing_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`approver_id` text NOT NULL,
	`approver_role` text NOT NULL,
	`decision` text DEFAULT 'APPROVED' NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `clearing_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clearing_approval_uq` ON `clearing_approvals` (`request_id`,`approver_id`);--> statement-breakpoint
CREATE TABLE `clearing_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`target_id` text NOT NULL,
	`target_preview` text NOT NULL,
	`reason` text NOT NULL,
	`requested_by_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`executed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `clearing_status_idx` ON `clearing_requests` (`status`);--> statement-breakpoint
CREATE TABLE `daily_status` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`reason` text,
	`half_day_part` text,
	`half_day_time` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_user_date_uq` ON `daily_status` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `daily_date_idx` ON `daily_status` (`date`);--> statement-breakpoint
CREATE TABLE `experiment_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`experiment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`updated_by_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expcomp_uq` ON `experiment_completions` (`experiment_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `expcomp_user_idx` ON `experiment_completions` (`user_id`);--> statement-breakpoint
CREATE TABLE `experiment_records` (
	`id` text PRIMARY KEY NOT NULL,
	`experiment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`file_id` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`verified_by_id` text,
	`verified_at` integer,
	`verification_note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experiment_records_file_id_unique` ON `experiment_records` (`file_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `exprec_uq` ON `experiment_records` (`experiment_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `experiment_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`experiment_id` text NOT NULL,
	`uploader_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`file_id` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`verified_by_id` text,
	`verified_at` integer,
	`note` text,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experiment_resources_file_id_unique` ON `experiment_resources` (`file_id`);--> statement-breakpoint
CREATE INDEX `eres_exp_status_idx` ON `experiment_resources` (`experiment_id`,`status`);--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`number` integer NOT NULL,
	`name` text NOT NULL,
	`details` text,
	`instructions` text,
	`required_files_note` text,
	`created_by_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exp_subject_number_uq` ON `experiments` (`subject_id`,`number`);--> statement-breakpoint
CREATE TABLE `file_objects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`module` text NOT NULL,
	`entity_id` text,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_key` text NOT NULL,
	`sha256` text,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `file_objects_storage_key_unique` ON `file_objects` (`storage_key`);--> statement-breakpoint
CREATE INDEX `files_module_idx` ON `file_objects` (`module`,`entity_id`);--> statement-breakpoint
CREATE TABLE `leave_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`leave_id` text NOT NULL,
	`file_id` text NOT NULL,
	`uploaded_by_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`confirmed_by_id` text,
	`confirmed_at` integer,
	FOREIGN KEY (`leave_id`) REFERENCES `leave_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leave_documents_file_id_unique` ON `leave_documents` (`file_id`);--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`from_date` text NOT NULL,
	`to_date` text NOT NULL,
	`reason` text NOT NULL,
	`contact` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`decided_by_id` text,
	`decided_at` integer,
	`decision_note` text,
	`withdrawal_requested` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `leave_user_idx` ON `leave_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `leave_status_idx` ON `leave_requests` (`status`);--> statement-breakpoint
CREATE TABLE `advisor_meeting_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`message` text NOT NULL,
	`date` text,
	`time` text,
	`location` text,
	`reason` text,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`created_by_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `meetings_student_idx` ON `advisor_meeting_requests` (`student_id`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`prefs` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notif_user_idx` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `od_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`od_id` text NOT NULL,
	`file_id` text NOT NULL,
	`uploaded_by_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`confirmed_by_id` text,
	`confirmed_at` integer,
	FOREIGN KEY (`od_id`) REFERENCES `od_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `od_documents_file_id_unique` ON `od_documents` (`file_id`);--> statement-breakpoint
CREATE TABLE `od_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`program_name` text NOT NULL,
	`place` text NOT NULL,
	`date` text NOT NULL,
	`from_time` text NOT NULL,
	`to_time` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`decided_by_id` text,
	`decided_at` integer,
	`decision_note` text,
	`withdrawal_requested` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `od_user_idx` ON `od_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `od_status_idx` ON `od_requests` (`status`);--> statement-breakpoint
CREATE TABLE `out_of_class_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`destination` text NOT NULL,
	`reason` text NOT NULL,
	`out_at` integer NOT NULL,
	`expected_return_at` integer NOT NULL,
	`back_at` integer,
	`status` text DEFAULT 'OUT' NOT NULL,
	`cleared_by_id` text,
	`cleared_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ooc_status_idx` ON `out_of_class_records` (`status`);--> statement-breakpoint
CREATE INDEX `ooc_user_idx` ON `out_of_class_records` (`user_id`);--> statement-breakpoint
CREATE TABLE `password_resets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`temp_password` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_by_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pwreset_token_uq` ON `password_resets` (`token_hash`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `push_user_idx` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`user_agent` text,
	`ip` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`faculty_name` text NOT NULL,
	`faculty_floor` text,
	`faculty_room` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_code_uq` ON `subjects` (`code`);--> statement-breakpoint
CREATE TABLE `teacher_visit_records` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`teacher_name` text NOT NULL,
	`location` text NOT NULL,
	`reason` text NOT NULL,
	`out_at` integer NOT NULL,
	`expected_return_at` integer NOT NULL,
	`return_status` text DEFAULT 'OUT' NOT NULL,
	`returned_at` integer,
	`created_by_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `visits_student_idx` ON `teacher_visit_records` (`student_id`);--> statement-breakpoint
CREATE TABLE `timetable_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`day_of_week` integer NOT NULL,
	`period` integer NOT NULL,
	`subject_id` text,
	`is_lab` integer DEFAULT false NOT NULL,
	`lab_name` text,
	`lab_floor` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tt_day_period_uq` ON `timetable_slots` (`day_of_week`,`period`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`reg_no` text,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`dob` text,
	`blood_group` text,
	`address` text,
	`mobile` text,
	`must_change_password` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_uq` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_regno_uq` ON `users` (`reg_no`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);