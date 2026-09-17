// BullMQ worker bootstrap ONLY. Same image as the api, different command.
//
// TODO: connect to REDIS_URL
// TODO: register the processors from queue/jobs/
// TODO: concurrency from env, sane default
// TODO: log job start/finish/fail with pino. Never console.log.
// TODO: graceful shutdown - drain in-flight jobs on SIGTERM
