// zod parsing of tender request bodies. Runs BEFORE the service, always.
//
// TODO: createTenderBody, listTenderQuery, tenderIdParam
// TODO: on failure -> { error, code: 'VALIDATION_FAILED' } + 400
