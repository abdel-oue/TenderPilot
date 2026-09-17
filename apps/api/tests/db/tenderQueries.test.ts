// DB tests run against the compose Postgres with migrations applied, inside a
// transaction that ROLLS BACK. No test leaves rows behind.
//
// TODO: it('returns only the projected columns')
// TODO: it('rejects a duplicate AO reference')
