-- ১. বর্তমানে কি কি জব আছে তা দেখা (এটি রান করে রেজাল্ট দেখুন)
SELECT * FROM cron.job;

-- ২. এই ফাংশন ইউআরএল (instagram-gopals-diary-job) যুক্ত সব শিডিউল মুছে দেওয়া
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE command LIKE '%instagram-gopals-diary-job%';


-- আগের শিডিউল ডিলিট করা
select cron.unschedule(jobid) from cron.job where jobname = 'instagram-gopals-diary-job';

-- নতুন শিডিউল
select
  cron.schedule(
    'instagram-gopals-diary-job',
    '*/15 * * * *',
    $$
    select
      net.http_post(
        url:='https://mwkoqxtyxdkkqlakrrvd.supabase.co/functions/v1/super-task',
        body:='{"tableName": "z_insta_sche_gopals_diary", "igUserId": "17841405649166532", "fbToken": "EAARj741yrocBRJndlZC0sLKVRzgaKcE2tWscpyr7xf4H1urwtZC5NR25jGpCz1sC5b7rEtogxKDDrQZCmx68HFiNcMqhg5AaJ5CYXZAwkZAp9XaoQUyfVbGgCoFM9irZCnJLDPnoGzU2lZBHaYtqX9V6HB9OF54BNLMo21uZBp4oDSj3pguVK3GGGN4QhCFH"}',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13a29xeHR5eGRra3FsYWtycnZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjY3NjM4NywiZXhwIjoyMDgyMjUyMzg3fQ.2SvderBmI6Ick5Z91M4hrmJwKuXQZmvwWxQOpZod1kg"}'
      );
    $$
  );
