-- আগের শিডিউল ডিলিট করা
select cron.unschedule(jobid) from cron.job where jobname = 'instagram-final-scheduler';

-- নতুন শিডিউল (প্রতি ১৫ মিনিট অন্তর চেক করবে)
select
  cron.schedule(
    'instagram-final-scheduler',
    '*/15 * * * *',  -- এই অংশটি প্রতি ১৫ মিনিটে একবার চেক করবে
    $$
    select
      net.http_post(
        url:='https://mwkoqxtyxdkkqlakrrvd.supabase.co/functions/v1/Scheduled-Publishing',
        body:='{}',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13a29xeHR5eGRra3FsYWtycnZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjY3NjM4NywiZXhwIjoyMDgyMjUyMzg3fQ.2SvderBmI6Ick5Z91M4hrmJwKuXQZmvwWxQOpZod1kg"}'
      );
    $$
  );
