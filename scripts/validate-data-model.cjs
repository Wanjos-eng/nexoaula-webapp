// Documentary validation only: PostgreSQL/WASM in memory, no connection URL.
// Dependencies are installed in a separate tools directory; see data-model.md.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

async function main() {
  if (!process.argv[2]) throw new Error('Usage: node scripts/validate-data-model.cjs <tools-directory> [model.dbml]');
  const toolRequire = createRequire(path.resolve(process.argv[2], 'package.json'));
  const { Parser, ModelExporter } = toolRequire('@dbml/core');
  const { PGlite } = toolRequire('@electric-sql/pglite');
  const file = path.resolve(process.argv[3] || path.join(__dirname, '../docs/diagrams/nexoaula.dbml'));
  const model = new Parser().parse(fs.readFileSync(file, 'utf8'), 'dbmlv2');
  const sql = ModelExporter.export(model, 'postgres');
  const db = new PGlite();
  const results = { passed: [], boundaries: [] };
  const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  const q = n => `'${id(n)}'`;
  async function probe(name, statement, expectedCode, boundary = false) {
    await db.exec('BEGIN');
    let error;
    try { await db.exec(statement); } catch (caught) { error = caught; }
    finally { await db.exec('ROLLBACK'); }
    if (boundary) {
      // Report known application/migration responsibilities, not assertions that
      // would force future implementations to preserve a missing constraint.
      if (error && !['23503', '23505', '23514'].includes(error.code)) throw error;
      results.boundaries.push({ name, enforcedByDbml: Boolean(error), code: error?.code });
    } else {
      assert.equal(error?.code, expectedCode, `${name}: ${error?.message || 'statement accepted'}`);
      results.passed.push(name);
    }
  }
  try {
    await db.exec(sql);
    const tables = (await db.query("select count(*)::int as n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")).rows[0].n;
    assert.equal(tables, 45);
    results.passed.push('DBML v2 exports and creates 45 PostgreSQL tables');
    assert.equal((await db.query("select to_regclass('public.user_class_sections') as table_name")).rows[0].table_name, null);
    results.passed.push('standalone class-following table is absent');
    // All fixtures are synthetic; no external services or real credentials.
    await db.exec(`
      INSERT INTO users(id,email,password_hash) VALUES (${q(1)},'alice@example.invalid','synthetic-hash'),(${q(2)},'bob@example.invalid','synthetic-hash');
      INSERT INTO institutions(id,name) VALUES (${q(10)},'Institution A'),(${q(11)},'Institution B');
      INSERT INTO courses(id,institution_id,name) VALUES (${q(12)},${q(10)},'Course A');
      INSERT INTO subjects(id,institution_id,name) VALUES (${q(20)},${q(10)},'Subject A'),(${q(21)},${q(11)},'Subject B');
      INSERT INTO academic_terms(id,institution_id,label,start_date,end_date) VALUES (${q(30)},${q(10)},'2026.2','2026-08-01','2026-12-31'),(${q(31)},${q(11)},'2026.2','2026-08-01','2026-12-31');
      INSERT INTO class_sections(id,institution_id,subject_id,academic_term_id,label,created_by) VALUES (${q(40)},${q(10)},${q(20)},${q(30)},'A',${q(1)}),(${q(41)},${q(11)},${q(21)},${q(31)},'B',${q(2)});
      INSERT INTO topics(id,slug,name) VALUES (${q(50)},'topic-a','Topic A');
      INSERT INTO subject_topics(id,subject_id,topic_id) VALUES (${q(51)},${q(20)},${q(50)}),(${q(52)},${q(21)},${q(50)});
      INSERT INTO study_groups(id,created_by,subject_id,class_section_id,name) VALUES (${q(70)},${q(1)},${q(20)},${q(40)},'Group A'),(${q(71)},${q(2)},${q(21)},${q(41)},'Group B'),(${q(77)},${q(1)},${q(20)},${q(40)},'Another group, same class');
      INSERT INTO group_members(group_id,user_id,role) VALUES (${q(70)},${q(1)},'owner');
      INSERT INTO group_members(group_id,user_id,role) VALUES (${q(71)},${q(2)},'owner');
      INSERT INTO group_members(group_id,user_id,role) VALUES (${q(77)},${q(1)},'owner');
      INSERT INTO group_topics(id,group_id,subject_id,subject_topic_id) VALUES (${q(53)},${q(70)},${q(20)},${q(51)}),(${q(54)},${q(71)},${q(21)},${q(52)});
      INSERT INTO teaching_plans(id,group_id,version,status,published_by,published_at,created_by) VALUES (${q(60)},${q(70)},1,'published',${q(1)},now(),${q(1)}),(${q(61)},${q(71)},1,'published',${q(2)},now(),${q(2)});
      INSERT INTO scheduled_lessons(id,teaching_plan_id,group_id,planned_start_at) VALUES (${q(62)},${q(60)},${q(70)},'2026-09-03T12:00:00Z'),(${q(63)},${q(61)},${q(71)},'2026-09-03T12:00:00Z');
      INSERT INTO lesson_occurrences(id,group_id,scheduled_lesson_id,status,actual_started_at,actual_ended_at,recorded_by) VALUES (${q(64)},${q(70)},${q(62)},'held',now()-interval '2 hours',now()-interval '1 hour',${q(1)});
      INSERT INTO group_join_requests(group_id,user_id) VALUES (${q(70)},${q(2)});
      INSERT INTO channels(id,group_id,name,created_by) VALUES (${q(72)},${q(70)},'general',${q(1)}),(${q(73)},${q(71)},'general',${q(2)});
      INSERT INTO channel_messages(id,channel_id,author_id,content) VALUES (${q(74)},${q(72)},${q(1)},'Synthetic message');
      INSERT INTO files(id,owner_id,purpose,storage_key,mime_type,size_bytes) VALUES (${q(80)},${q(1)},'material_content','synthetic/material','application/pdf',1);
      INSERT INTO tutor_profiles(user_id) VALUES (${q(1)});
      INSERT INTO materials(id,creator_user_id,subject_id,file_id,title) VALUES (${q(81)},${q(1)},${q(20)},${q(80)},'Material A');
      INSERT INTO tutor_sessions(id,tutor_user_id,subject_id,title,modality,external_url,starts_at,ends_at,capacity,price_cents) VALUES (${q(82)},${q(1)},${q(20)},'Session A','online','https://example.invalid','2026-09-04T12:00:00Z','2026-09-04T13:00:00Z',3,1000);
      INSERT INTO session_bookings(id,session_id,user_id) VALUES (${q(83)},${q(82)},${q(2)});
      INSERT INTO transactions(id,buyer_id,session_booking_id,amount_cents,status,completed_at) VALUES (${q(84)},${q(2)},${q(83)},1000,'completed',now());
      INSERT INTO transactions(id,buyer_id,material_id,amount_cents) VALUES (${q(85)},${q(2)},${q(81)},1000);
    `);
    const tests = [
      ['email case-insensitive uniqueness', "INSERT INTO users(email,password_hash) VALUES ('ALICE@example.invalid','synthetic')", '23505'],
      ['profile cannot use course from another institution', `INSERT INTO user_profiles(user_id,display_name,institution_id,course_id) VALUES (${q(1)},'Alice',${q(11)},${q(12)})`, '23503'],
      ['profile course requires institution', `INSERT INTO user_profiles(user_id,display_name,course_id) VALUES (${q(1)},'Alice',${q(12)})`, '23514'],
      ['course-subject institution coherence', `INSERT INTO course_subjects(course_id,subject_id,institution_id) VALUES (${q(12)},${q(21)},${q(10)})`, '23503'],
      ['class-section institution coherence', `UPDATE class_sections SET subject_id=${q(21)} WHERE id=${q(40)}`, '23503'],
      ['group optional class-section matches subject', `UPDATE study_groups SET class_section_id=${q(41)} WHERE id=${q(70)}`, '23503'],
      ['valid group optional class-section', `UPDATE study_groups SET class_section_id=${q(40)} WHERE id=${q(70)}`],
      ['period date interval', `UPDATE academic_terms SET end_date='2026-01-01' WHERE id=${q(30)}`, '23514'],
      ['schedule weekday range', `INSERT INTO class_section_schedules(class_section_id,day_of_week,start_time,end_time) VALUES (${q(40)},8,'10:00','11:00')`, '23514'],
      ['schedule time interval', `INSERT INTO class_section_schedules(class_section_id,day_of_week,start_time,end_time) VALUES (${q(40)},1,'11:00','10:00')`, '23514'],
      ['file positive size', `UPDATE files SET size_bytes=0 WHERE id=${q(80)}`, '23514'],
      ['publication requires author/date', `UPDATE teaching_plans SET published_at=NULL WHERE id=${q(60)}`, '23514'],
      ['plan cannot derive from itself', `UPDATE teaching_plans SET based_on_plan_id=id WHERE id=${q(60)}`, '23514'],
      ['planned class interval', `UPDATE scheduled_lessons SET planned_end_at='2026-01-01' WHERE id=${q(62)}`, '23514'],
      ['held occurrence requires start', `UPDATE lesson_occurrences SET actual_started_at=NULL WHERE id=${q(64)}`, '23514'],
      ['cancelled occurrence rejects actual start', `UPDATE lesson_occurrences SET status='cancelled' WHERE id=${q(64)}`, '23514'],
      ['valid postponed occurrence', `INSERT INTO lesson_occurrences(group_id,status,rescheduled_to,recorded_by) VALUES (${q(70)},'postponed','2026-09-05',${q(1)})`],
      ['occurrence cannot supersede itself', `UPDATE lesson_occurrences SET supersedes_occurrence_id=id WHERE id=${q(64)}`, '23514'],
      ['correction exactly one target', `INSERT INTO planning_corrections(suggested_by,original_snapshot,proposed_patch,kind) VALUES (${q(1)},'{}','{}','details')`, '23514'],
      ['correction payload must be object', `INSERT INTO planning_corrections(suggested_by,scheduled_lesson_id,original_snapshot,proposed_patch,kind) VALUES (${q(1)},${q(62)},'[]','{}','details')`, '23514'],
      ['membership lifecycle', `UPDATE group_members SET status='left' WHERE group_id=${q(70)}`, '23514'],
      ['join request resolution actor/date', `UPDATE group_join_requests SET status='approved' WHERE group_id=${q(70)}`, '23514'],
      ['group capacity positive', `UPDATE study_groups SET capacity=0 WHERE id=${q(70)}`, '23514'],
      ['channel archive consistency', `UPDATE channels SET status='archived' WHERE id=${q(72)}`, '23514'],
      ['meeting online requires URL', `INSERT INTO meetings(group_id,organizer_id,title,modality,starts_at) VALUES (${q(70)},${q(1)},'Test','online',now())`, '23514'],
      ['material optional class-section matches subject', `UPDATE materials SET class_section_id=${q(41)} WHERE id=${q(81)}`, '23503'],
      ['session positive capacity', `UPDATE tutor_sessions SET capacity=0 WHERE id=${q(82)}`, '23514'],
      ['booking attendance needs timestamp', `UPDATE session_bookings SET status='attended' WHERE id=${q(83)}`, '23514'],
      ['transaction buyer must own booking', `UPDATE transactions SET buyer_id=${q(1)} WHERE id=${q(84)}`, '23503'],
      ['transaction rejects two targets', `UPDATE transactions SET material_id=${q(81)} WHERE id=${q(84)}`, '23514'],
      ['transaction rejects no target', `UPDATE transactions SET material_id=NULL WHERE id=${q(85)}`, '23514'],
      ['commission cannot exceed amount', `UPDATE transactions SET commission_cents=1001 WHERE id=${q(84)}`, '23514'],
      ['transaction refund timestamp required', `UPDATE transactions SET status='refunded' WHERE id=${q(84)}`, '23514'],
      ['review rating range', `INSERT INTO reviews(transaction_id,session_booking_id,booking_status,rating) VALUES (${q(84)},${q(83)},'attended',6)`, '23514'],
      ['valid review and duplicate rejection', `UPDATE session_bookings SET status='attended',attended_at=now(),attendance_recorded_by=${q(1)} WHERE id=${q(83)}; INSERT INTO reviews(transaction_id,session_booking_id,booking_status,rating) VALUES (${q(84)},${q(83)},'attended',5); INSERT INTO reviews(transaction_id,session_booking_id,booking_status,rating) VALUES (${q(84)},${q(83)},'attended',4)`, '23505'],
      ['user hard deletion restricted by authored records', `DELETE FROM users WHERE id=${q(1)}`, '23001'],
      ['valid personal attendance', `INSERT INTO student_lesson_attendance(user_id,lesson_occurrence_id,status) VALUES (${q(2)},${q(64)},'present')`],
      ['teacher start date is required', `INSERT INTO teachers(id,institution_id,full_name) VALUES (${q(90)},${q(10)},'Teacher'); INSERT INTO class_section_teachers(class_section_id,teacher_id,institution_id) VALUES (${q(40)},${q(90)},${q(10)})`, '23502'],
      ['planned lesson must match plan group', `INSERT INTO scheduled_lessons(teaching_plan_id,group_id,planned_start_at) VALUES (${q(60)},${q(71)},now())`, '23503'],
      ['occurrence successor must stay in same group', `INSERT INTO lesson_occurrences(group_id,supersedes_occurrence_id,status,actual_started_at,actual_ended_at,recorded_by) VALUES (${q(71)},${q(64)},'held',now()-interval '2 hours',now()-interval '1 hour',${q(1)})`, '23503'],
      ['valid same-group plan version', `INSERT INTO teaching_plans(group_id,version,based_on_plan_id,created_by) VALUES (${q(70)},2,${q(60)},${q(1)})`],
      ['valid same-group occurrence successor', `INSERT INTO lesson_occurrences(group_id,supersedes_occurrence_id,status,actual_started_at,actual_ended_at,recorded_by) VALUES (${q(70)},${q(64)},'held',now()-interval '2 hours',now()-interval '1 hour',${q(1)})`],
      ['occurrence cannot have two direct successors', `INSERT INTO lesson_occurrences(group_id,supersedes_occurrence_id,status,actual_started_at,actual_ended_at,recorded_by) VALUES (${q(70)},${q(64)},'held',now()-interval '2 hours',now()-interval '1 hour',${q(1)}),(${q(70)},${q(64)},'held',now()-interval '2 hours',now()-interval '1 hour',${q(1)})`, '23505'],
      ['valid same-channel reply', `INSERT INTO channel_messages(channel_id,author_id,reply_to_message_id,content) VALUES (${q(72)},${q(2)},${q(74)},'Reply')`],
      ['valid same-group meeting channel', `INSERT INTO meetings(group_id,channel_id,organizer_id,title,modality,external_url,starts_at) VALUES (${q(70)},${q(72)},${q(1)},'Meeting','online','https://example.invalid',now())`],
      ['hard deleting reply target clears only reply id', `
        INSERT INTO channel_messages(id,channel_id,author_id,reply_to_message_id,content) VALUES (${q(75)},${q(72)},${q(2)},${q(74)},'Reply');
        DELETE FROM channel_messages WHERE id=${q(74)};
        DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM channel_messages WHERE id=${q(75)} AND channel_id=${q(72)} AND reply_to_message_id IS NULL) THEN RAISE EXCEPTION 'Reply/channel lost'; END IF; END $$;
      `],
      ['hard deleting channel clears only optional meeting channel', `
        INSERT INTO meetings(id,group_id,channel_id,organizer_id,title,modality,external_url,starts_at) VALUES (${q(76)},${q(70)},${q(72)},${q(1)},'Meeting','online','https://example.invalid',now());
        DELETE FROM channels WHERE id=${q(72)};
        DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM meetings WHERE id=${q(76)} AND group_id=${q(70)} AND channel_id IS NULL) THEN RAISE EXCEPTION 'Meeting/group lost'; END IF; END $$;
      `],
      ['group with academic history cannot be hard deleted', `
        INSERT INTO channel_messages(channel_id,author_id,reply_to_message_id,content) VALUES (${q(72)},${q(2)},${q(74)},'Reply');
        INSERT INTO meetings(group_id,channel_id,organizer_id,title,modality,external_url,starts_at) VALUES (${q(70)},${q(72)},${q(1)},'Meeting','online','https://example.invalid',now());
        DELETE FROM study_groups WHERE id=${q(70)};
        DO $$ BEGIN IF EXISTS (SELECT 1 FROM channels WHERE group_id=${q(70)}) OR EXISTS (SELECT 1 FROM meetings WHERE group_id=${q(70)}) THEN RAISE EXCEPTION 'Cascade incomplete'; END IF; END $$;
      `, '23001'],
      ['multiple drafts remain allowed', `INSERT INTO teaching_plans(group_id,version,created_by) VALUES (${q(70)},2,${q(1)}),(${q(70)},3,${q(1)})`],
      ['publication handover preserves old plan', `UPDATE teaching_plans SET status='superseded' WHERE id=${q(60)}; INSERT INTO teaching_plans(group_id,version,status,published_by,published_at,created_by,based_on_plan_id) VALUES (${q(70)},2,'published',${q(1)},now(),${q(1)},${q(60)})`],
      ['ownership transfer permits a single new active owner', `UPDATE group_members SET role='member' WHERE group_id=${q(70)}; INSERT INTO group_members(group_id,user_id,role) VALUES (${q(70)},${q(2)},'owner')`],
      ['inactive owner history does not prevent transfer', `UPDATE group_members SET status='left',ended_at=now() WHERE group_id=${q(70)}; INSERT INTO group_members(group_id,user_id,role) VALUES (${q(70)},${q(2)},'owner')`],
      ['pending request can follow rejected or cancelled attempts', `UPDATE group_join_requests SET status='rejected',resolved_by=${q(1)},resolved_at=now() WHERE group_id=${q(70)}; INSERT INTO group_join_requests(group_id,user_id,status,resolved_by,resolved_at) VALUES (${q(70)},${q(2)},'cancelled',${q(2)},now()); INSERT INTO group_join_requests(group_id,user_id) VALUES (${q(70)},${q(2)})`],
      ['multiple failed payment simulations retain history', `INSERT INTO transactions(buyer_id,session_booking_id,amount_cents,status) VALUES (${q(2)},${q(83)},1000,'failed'),(${q(2)},${q(83)},1000,'failed')`],
      ['cancelled booking permits a new attempt without erasing history', `
        UPDATE session_bookings SET status='cancelled',cancelled_at=now() WHERE id=${q(83)};
        INSERT INTO session_bookings(session_id,user_id) VALUES (${q(82)},${q(2)});
        DO $$ BEGIN IF (SELECT count(*) FROM session_bookings WHERE session_id=${q(82)} AND user_id=${q(2)}) <> 2 THEN RAISE EXCEPTION 'Booking history lost'; END IF; END $$;
      `],
      ['active duplicate booking rejected', `INSERT INTO session_bookings(session_id,user_id) VALUES (${q(82)},${q(2)})`, '23505'],
      ['old cancellation cannot be reactivated alongside new booking', `UPDATE session_bookings SET status='cancelled',cancelled_at=now() WHERE id=${q(83)}; INSERT INTO session_bookings(session_id,user_id) VALUES (${q(82)},${q(2)}); UPDATE session_bookings SET status='reserved',cancelled_at=NULL WHERE id=${q(83)}`, '23505'],
      ['attendance needs tutor identity even when timestamp exists', `UPDATE session_bookings SET status='attended',attended_at=now() WHERE id=${q(83)}`, '23514'],
      ['attendance rejects another tutor as recorder', `INSERT INTO tutor_profiles(user_id) VALUES (${q(2)}); UPDATE session_bookings SET status='attended',attended_at=now(),attendance_recorded_by=${q(2)} WHERE id=${q(83)}`, '23503'],
      ['attendance allows the session tutor', `UPDATE session_bookings SET status='attended',attended_at=now(),attendance_recorded_by=${q(1)} WHERE id=${q(83)}`],
      ['non-attended booking rejects attendance metadata', `UPDATE session_bookings SET attended_at=now(),attendance_recorded_by=${q(1)} WHERE id=${q(83)}`, '23514'],
      ['non-cancelled booking rejects cancellation timestamp', `UPDATE session_bookings SET cancelled_at=now() WHERE id=${q(83)}`, '23514'],
      ['cancellation cannot predate booking', `UPDATE session_bookings SET status='cancelled',cancelled_at=booked_at-interval '1 second' WHERE id=${q(83)}`, '23514'],
      ['plan must have a group', `INSERT INTO teaching_plans(version,created_by) VALUES (1,${q(1)})`, '23502'],
      ['groups of the same class can publish independent plans', `INSERT INTO teaching_plans(group_id,version,status,published_by,published_at,created_by) VALUES (${q(77)},1,'published',${q(1)},now(),${q(1)})`],
      ['same-class groups cannot share a base plan reference', `INSERT INTO teaching_plans(group_id,version,based_on_plan_id,created_by) VALUES (${q(77)},1,${q(60)},${q(1)})`, '23503'],
      ['same-class groups cannot share a planned lesson', `INSERT INTO scheduled_lessons(teaching_plan_id,group_id,planned_start_at) VALUES (${q(60)},${q(77)},now())`, '23503'],
      ['plan author must have a membership record in that group', `INSERT INTO teaching_plans(group_id,version,created_by) VALUES (${q(70)},2,${q(2)})`, '23503'],
      ['held occurrence needs an actual end', `UPDATE lesson_occurrences SET actual_ended_at=NULL WHERE id=${q(64)}`, '23514'],
      ['future class cannot be recorded as already held', `INSERT INTO lesson_occurrences(group_id,status,actual_started_at,actual_ended_at,recorded_by) VALUES (${q(70)},'held',now()+interval '1 day',now()+interval '1 day 1 hour',${q(1)})`, '23514'],
      ['ongoing class cannot be recorded as already held', `INSERT INTO lesson_occurrences(group_id,status,actual_started_at,actual_ended_at,recorded_by) VALUES (${q(70)},'held',now()-interval '1 hour',now()+interval '1 hour',${q(1)})`, '23514'],
      ['attendance cannot point to a nonexistent class', `INSERT INTO student_lesson_attendance(user_id,lesson_occurrence_id,status) VALUES (${q(1)},${q(999)},'present')`, '23503'],
      ['postponed class cannot receive attendance', `INSERT INTO lesson_occurrences(id,group_id,status,rescheduled_to,recorded_by) VALUES (${q(65)},${q(70)},'postponed',now()+interval '1 day',${q(1)}); INSERT INTO student_lesson_attendance(user_id,lesson_occurrence_id,status) VALUES (${q(1)},${q(65)},'present')`, '23503'],
      ['attendance discriminator cannot be changed to cancelled', `INSERT INTO student_lesson_attendance(user_id,lesson_occurrence_id,occurrence_status,status) VALUES (${q(1)},${q(64)},'cancelled','present')`, '23514'],
      ['valid private progress refers to content provided by group', `INSERT INTO student_topic_progress(user_id,group_topic_id,status) VALUES (${q(1)},${q(53)},'reviewing')`],
      ['progress cannot refer to an unscoped global topic', `INSERT INTO student_topic_progress(user_id,group_topic_id,status) VALUES (${q(1)},${q(50)},'reviewing')`, '23503'],
      ['session review requires actual participation', `INSERT INTO reviews(transaction_id,session_booking_id,booking_status,rating) VALUES (${q(84)},${q(83)},'attended',5)`, '23503'],
      ['review cannot pretend a reserved booking is eligible', `INSERT INTO reviews(transaction_id,session_booking_id,booking_status,rating) VALUES (${q(84)},${q(83)},'reserved',5)`, '23514'],
      ['attended participant can review the session', `UPDATE session_bookings SET status='attended',attended_at=now(),attendance_recorded_by=${q(1)} WHERE id=${q(83)}; INSERT INTO reviews(transaction_id,session_booking_id,booking_status,rating) VALUES (${q(84)},${q(83)},'attended',5)`],
      ['session review cannot masquerade as a material review', `INSERT INTO reviews(transaction_id,material_id,rating) VALUES (${q(84)},${q(81)},5)`, '23503'],
      ['review needs a concrete experience target', `INSERT INTO reviews(transaction_id,rating) VALUES (${q(84)},5)`, '23514'],
      ['cancellation correction preserves previous entry only as history', `
        INSERT INTO student_lesson_attendance(user_id,lesson_occurrence_id,status,notes) VALUES (${q(1)},${q(64)},'present','Original note');
        INSERT INTO lesson_occurrences(id,group_id,supersedes_occurrence_id,status,recorded_by) VALUES (${q(65)},${q(70)},${q(64)},'cancelled',${q(1)});
        INSERT INTO student_attendance_adjustments(user_id,source_occurrence_id,target_occurrence_id,target_status,outcome,previous_status,previous_notes) VALUES (${q(1)},${q(64)},${q(65)},'cancelled','invalidated','present','Original note');
        DO $$ BEGIN
          IF (SELECT count(*) FROM student_lesson_attendance WHERE user_id=${q(1)}) <> 1 THEN RAISE EXCEPTION 'Old entry must remain without cancelled destination attendance'; END IF;
          IF NOT EXISTS (SELECT 1 FROM student_attendance_adjustments WHERE user_id=${q(1)} AND notice_seen_at IS NULL) THEN RAISE EXCEPTION 'Missing unread notice'; END IF;
        END $$;
      `],
      ['past held correction supports copy without replacing history', `
        INSERT INTO student_lesson_attendance(user_id,lesson_occurrence_id,status,notes) VALUES (${q(1)},${q(64)},'absent','Original note');
        INSERT INTO lesson_occurrences(id,group_id,supersedes_occurrence_id,status,actual_started_at,actual_ended_at,recorded_by) VALUES (${q(65)},${q(70)},${q(64)},'held',now()-interval '2 hours',now()-interval '1 hour',${q(1)});
        INSERT INTO student_lesson_attendance(user_id,lesson_occurrence_id,status,notes) SELECT user_id,${q(65)},status,notes FROM student_lesson_attendance WHERE user_id=${q(1)} AND lesson_occurrence_id=${q(64)};
        INSERT INTO student_attendance_adjustments(user_id,source_occurrence_id,target_occurrence_id,target_status,outcome,previous_status,previous_notes) VALUES (${q(1)},${q(64)},${q(65)},'held','transferred','absent','Original note');
        DO $$ BEGIN IF (SELECT count(*) FROM student_lesson_attendance WHERE user_id=${q(1)} AND notes='Original note') <> 2 THEN RAISE EXCEPTION 'Source or destination entry lost'; END IF; END $$;
      `],
      ['adjustment cannot reference another students source entry', `
        INSERT INTO student_lesson_attendance(user_id,lesson_occurrence_id,status) VALUES (${q(1)},${q(64)},'present');
        INSERT INTO lesson_occurrences(id,group_id,supersedes_occurrence_id,status,recorded_by) VALUES (${q(65)},${q(70)},${q(64)},'cancelled',${q(1)});
        INSERT INTO student_attendance_adjustments(user_id,source_occurrence_id,target_occurrence_id,target_status,outcome,previous_status) VALUES (${q(2)},${q(64)},${q(65)},'cancelled','invalidated','present');
      `, '23503'],
      ['a cancellation cannot be reported as a successful attendance transfer', `
        INSERT INTO student_lesson_attendance(user_id,lesson_occurrence_id,status) VALUES (${q(1)},${q(64)},'present');
        INSERT INTO lesson_occurrences(id,group_id,supersedes_occurrence_id,status,recorded_by) VALUES (${q(65)},${q(70)},${q(64)},'cancelled',${q(1)});
        INSERT INTO student_attendance_adjustments(user_id,source_occurrence_id,target_occurrence_id,target_status,outcome,previous_status) VALUES (${q(1)},${q(64)},${q(65)},'cancelled','transferred','present');
      `, '23514'],
      ['adjustment is idempotent for the same student and corrected class', `
        INSERT INTO student_lesson_attendance(user_id,lesson_occurrence_id,status) VALUES (${q(1)},${q(64)},'present');
        INSERT INTO lesson_occurrences(id,group_id,supersedes_occurrence_id,status,recorded_by) VALUES (${q(65)},${q(70)},${q(64)},'cancelled',${q(1)});
        INSERT INTO student_attendance_adjustments(user_id,source_occurrence_id,target_occurrence_id,target_status,outcome,previous_status) VALUES (${q(1)},${q(64)},${q(65)},'cancelled','invalidated','present'),(${q(1)},${q(64)},${q(65)},'cancelled','invalidated','present');
      `, '23505'],
    ];
    for (const [name, statement, code] of tests) await probe(name, statement, code);
    const boundaries = [
      ['reply from another channel', `INSERT INTO channel_messages(channel_id,author_id,reply_to_message_id,content) VALUES (${q(73)},${q(2)},${q(74)},'Cross-channel')`, '23503'],
      ['message replying to itself', `UPDATE channel_messages SET reply_to_message_id=id WHERE id=${q(74)}`, '23514'],
      ['meeting linked to another group channel', `INSERT INTO meetings(group_id,channel_id,organizer_id,title,modality,external_url,starts_at) VALUES (${q(70)},${q(73)},${q(1)},'Cross-group','online','https://example.invalid',now())`, '23503'],
      ['topic from another subject in group', `INSERT INTO group_topics(group_id,subject_id,subject_topic_id) VALUES (${q(70)},${q(20)},${q(52)})`, '23503'],
      ['occurrence linked to another group', `INSERT INTO lesson_occurrences(group_id,scheduled_lesson_id,status,actual_started_at,actual_ended_at,recorded_by) VALUES (${q(70)},${q(63)},'held',now()-interval '2 hours',now()-interval '1 hour',${q(1)})`, '23503'],
      ['plan derived from another group', `UPDATE teaching_plans SET based_on_plan_id=${q(61)} WHERE id=${q(60)}`, '23503'],
      ['second current published plan', `INSERT INTO teaching_plans(group_id,version,status,published_by,published_at,created_by) VALUES (${q(70)},2,'published',${q(1)},now(),${q(1)})`, '23505'],
      ['second active group owner', `INSERT INTO group_members(group_id,user_id,role) VALUES (${q(70)},${q(2)},'owner')`, '23505'],
      ['group without active owner', `UPDATE group_members SET role='member' WHERE group_id=${q(70)}`],
      ['duplicate pending join request', `INSERT INTO group_join_requests(group_id,user_id) VALUES (${q(70)},${q(2)})`, '23505'],
      ['review of pending transaction', `INSERT INTO reviews(transaction_id,material_id,rating) VALUES (${q(85)},${q(81)},5)`],
      ['second completed transaction for same booking', `INSERT INTO transactions(buyer_id,session_booking_id,amount_cents,status,completed_at) VALUES (${q(2)},${q(83)},1000,'completed',now())`, '23505'],
      ['two completed transactions cannot create two reviews for same booking', `UPDATE session_bookings SET status='attended',attended_at=now(),attendance_recorded_by=${q(1)} WHERE id=${q(83)}; INSERT INTO reviews(transaction_id,session_booking_id,booking_status,rating) VALUES (${q(84)},${q(83)},'attended',5); INSERT INTO transactions(id,buyer_id,session_booking_id,amount_cents,status,completed_at) VALUES (${q(86)},${q(2)},${q(83)},1000,'completed',now()); INSERT INTO reviews(transaction_id,session_booking_id,booking_status,rating) VALUES (${q(86)},${q(83)},'attended',5)`, '23505'],
      ['attendance on cancelled occurrence', `INSERT INTO lesson_occurrences(id,group_id,status,recorded_by) VALUES (${q(65)},${q(70)},'cancelled',${q(1)}); INSERT INTO student_lesson_attendance(user_id,lesson_occurrence_id,status) VALUES (${q(2)},${q(65)},'present')`, '23503'],
      ['cyclic plan lineage still requires backend enforcement', `INSERT INTO teaching_plans(id,group_id,version,based_on_plan_id,created_by) VALUES (${q(66)},${q(70)},2,${q(60)},${q(1)}); UPDATE teaching_plans SET based_on_plan_id=${q(66)} WHERE id=${q(60)}`],
      ['cyclic occurrence lineage still requires append-only enforcement', `INSERT INTO lesson_occurrences(id,group_id,supersedes_occurrence_id,status,actual_started_at,actual_ended_at,recorded_by) VALUES (${q(67)},${q(70)},${q(64)},'held',now()-interval '2 hours',now()-interval '1 hour',${q(1)}); UPDATE lesson_occurrences SET supersedes_occurrence_id=${q(67)} WHERE id=${q(64)}`],
      ['cyclic replies still require immutable reply targets', `INSERT INTO channel_messages(id,channel_id,author_id,reply_to_message_id,content) VALUES (${q(75)},${q(72)},${q(2)},${q(74)},'Reply'); UPDATE channel_messages SET reply_to_message_id=${q(75)} WHERE id=${q(74)}`],
      ['attendance write by nonmember still requires backend authorization', `INSERT INTO student_lesson_attendance(user_id,lesson_occurrence_id,status) VALUES (${q(2)},${q(64)},'present')`],
      ['superseded held occurrence still requires current-leaf filtering', `INSERT INTO lesson_occurrences(id,group_id,supersedes_occurrence_id,status,recorded_by) VALUES (${q(65)},${q(70)},${q(64)},'cancelled',${q(1)}); INSERT INTO student_lesson_attendance(user_id,lesson_occurrence_id,status) VALUES (${q(1)},${q(64)},'present')`],
      ['adjustment lineage must be checked by backend', `INSERT INTO student_lesson_attendance(user_id,lesson_occurrence_id,status) VALUES (${q(1)},${q(64)},'present'); INSERT INTO lesson_occurrences(id,group_id,status,recorded_by) VALUES (${q(65)},${q(71)},'cancelled',${q(2)}); INSERT INTO student_attendance_adjustments(user_id,source_occurrence_id,target_occurrence_id,target_status,outcome,previous_status) VALUES (${q(1)},${q(64)},${q(65)},'cancelled','invalidated','present')`],
    ];
    for (const [name, statement, code] of boundaries) await probe(name, statement, code, code === undefined);

    // Executable examples of the required service query contract, NOT deployed
    // API authorization, RLS policies, triggers, or automatic application flows.
    let referenceQueryCount = 0;
    const plansForMember = (actor, group) => db.query(`
      SELECT p.id FROM teaching_plans p
      JOIN group_members m ON m.group_id=p.group_id AND m.user_id=$1 AND m.status='active'
      WHERE p.group_id=$2 AND p.status='published'`, [id(actor), id(group)]);
    const currentOwnAttendance = (actor, requestedOwner) => db.query(`
      SELECT a.lesson_occurrence_id FROM student_lesson_attendance a
      JOIN lesson_occurrences o ON o.id=a.lesson_occurrence_id
      JOIN group_members m ON m.group_id=o.group_id AND m.user_id=$1 AND m.status='active'
      WHERE a.user_id=$1 AND a.user_id=$2 AND o.status='held'
        AND o.actual_ended_at <= statement_timestamp()
        AND NOT EXISTS (SELECT 1 FROM lesson_occurrences successor WHERE successor.supersedes_occurrence_id=o.id)
    `, [id(actor), id(requestedOwner)]);
    function queryCheck(name, actual, expected) {
      assert.equal(actual, expected, name);
      results.passed.push(`reference query: ${name}`);
      referenceQueryCount++;
    }
    await db.exec('BEGIN');
    try {
      queryCheck('active member sees group plan', (await plansForMember(1,70)).rows.length, 1);
      queryCheck('nonmember cannot see group plan', (await plansForMember(2,70)).rows.length, 0);
      await db.exec(`INSERT INTO student_lesson_attendance(user_id,lesson_occurrence_id,status) VALUES (${q(1)},${q(64)},'present'); INSERT INTO group_members(group_id,user_id) VALUES (${q(70)},${q(2)})`);
      queryCheck('student sees own current attendance', (await currentOwnAttendance(1,1)).rows.length, 1);
      queryCheck('another active member cannot see the students attendance', (await currentOwnAttendance(2,1)).rows.length, 0);
      await db.exec(`UPDATE group_members SET status='left',ended_at=now() WHERE group_id=${q(70)} AND user_id=${q(1)}`);
      queryCheck('former member cannot see group plan', (await plansForMember(1,70)).rows.length, 0);
      queryCheck('former member cannot use standalone attendance access', (await currentOwnAttendance(1,1)).rows.length, 0);
      await db.exec(`UPDATE group_members SET status='active',ended_at=NULL WHERE group_id=${q(70)} AND user_id=${q(1)}; INSERT INTO lesson_occurrences(id,group_id,supersedes_occurrence_id,status,recorded_by) VALUES (${q(65)},${q(70)},${q(64)},'cancelled',${q(1)})`);
      queryCheck('cancelled successor excludes old attendance from current totals', (await currentOwnAttendance(1,1)).rows.length, 0);
      queryCheck('old attendance remains available for authorized history processing', (await db.query(`SELECT 1 FROM student_lesson_attendance WHERE user_id=${q(1)}`)).rows.length, 1);
    } finally { await db.exec('ROLLBACK'); }
    const counts = (await db.query("select contype, count(*)::int as count from pg_constraint where connamespace='public'::regnamespace group by contype order by contype")).rows;
    console.log(JSON.stringify({ version: (await db.query('select version()')).rows[0].version,
      tools: { dbml: JSON.parse(fs.readFileSync(path.resolve(process.argv[2], 'node_modules/@dbml/core/package.json'), 'utf8')).version,
        pglite: JSON.parse(fs.readFileSync(path.resolve(process.argv[2], 'node_modules/@electric-sql/pglite/package.json'), 'utf8')).version },
      tables, constraints: counts, passedCount: results.passed.length, referenceQueryCount, ...results }, null, 2));
  } finally { await db.close(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
