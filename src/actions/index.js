import {createAction} from './utils';

export const startTransaction = createAction( 'MODEL_START_TRANSACTION' );
export const saveTransaction = createAction( 'MODEL_SAVE_TRANSACTION' );
export const commitTransaction = createAction( 'MODEL_COMMIT_TRANSACTION' );
export const abortTransaction = createAction( 'MODEL_ABORT_TRANSACTION' );
export const loadJsonApiResponse = createAction( 'MODEL_LOAD_JSON_API_RESPONSE' );
/* export const setDB = createAction( 'MODEL_SET_DB' );*/
export const sync = createAction( 'MODEL_SYNC' );
export const loadModels = createAction( 'MODEL_LOAD' );
export const loadModelView = createAction( 'MODEL_LOAD_VIEW' );
export const clearModelView = createAction( 'MODEL_LOAD_VIEW_CLEAR' );
