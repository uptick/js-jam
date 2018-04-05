import {createAction} from './utils'

/**
 * Basic actions.
 */
export const saveDB = createAction('MODEL_SAVE_DB')
export const rehydrateDB = createAction('MODEL_REHYDRATE')

/**
 * Transaction actions.
 */
export const startTransaction = createAction('MODEL_START_TRANSACTION')
export const saveTransaction = createAction('MODEL_SAVE_TRANSACTION')
export const commitTransaction = createAction('MODEL_COMMIT_TRANSACTION')
export const abortTransaction = createAction('MODEL_ABORT_TRANSACTION')

/**
 * Persistence actions.
 */
export const commitDB = createAction('MODEL_COMMIT')
export const syncDB = createAction('MODEL_SYNC')

/**
 * Model view actions.
 */
export const loadModelView = createAction( 'MODEL_LOAD_VIEW' )
export const clearModelView = createAction( 'MODEL_LOAD_VIEW_CLEAR' )
export const nextPage = createAction( 'MODEL_NEXT_PAGE' )
export const prevPage = createAction( 'MODEL_PREV_PAGE' )
export const firstPage = createAction( 'MODEL_FIRST_PAGE' )
export const lastPage = createAction( 'MODEL_LAST_PAGE' )
// export const prevPage = createAction( 'MODEL_NEXT_PAGE' )

/* export const loadJsonApiResponse = createAction( 'MODEL_LOAD_JSON_API_RESPONSE' )*/
/* export const setDB = createAction( 'MODEL_SET_DB' )*/

/* export const loadModels = createAction( 'MODEL_LOAD' )*/

