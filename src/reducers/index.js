import {combineReducers} from 'redux'

import DB from '../db'
import { createReducer } from './utils'
import { flattenObject } from '../utils'

/**
 * Manages the state for models loaded form a server. As an example
 * of what the store would look like, let's assume we have two model
 * types, Book and Author:
 */
const dbReducer = createReducer( null, {

  /**
   * Merge loaded models into the DB.
   */
  MODEL_LOAD_SUCCESS( state, action ) {
    let db = new DB( state );
    db.loadJsonApi( action.payload );
    return db.data;
  },

  /* MODEL_ADD_BLOCKS( state, action ) {
   *   let db = new DB( state );
   *   const {blocks} = action;
   *   for( const block of blocks )
   *     db.addBlock( block );
   *   return db.data;
   * },*/

  MODEL_LOAD_JSON( state, action ) {
    const {schema, jsonData} = action.payload;
    let db = schema.db( state );
    for( const data of jsonData )
      db.loadJsonApi( data );
    return db.data;
  },

  MODEL_SET_DB_DATA( state, action ) {
    return action.payload
  },

  /* MODEL_APPLY_BLOCK( state, action ) {
   *   let db = new DB( state );
   *   db.applyBlock( action.payload );
   *   return db.data;
   * },*/

  /* MODEL_COMMIT_DIFF( state, action ) {
   *   const { diff, response } = action.payload;
   *   let db = new DB( state );
   *   db.postCommitDiff( diff, response );
   *   db.popDiff();
   *   return {
   *     ...state,
   *     db: db.data
   *   };
   * },*/

  /* MODEL_LOAD_JSON_API_RESPONSE( state, action ) {
   *   const {schema, data} = action.payload;
   *   let db = schema.db( state );
   *   db.loadJsonApiResponse( data );
   *   return db.data;
   * },*/

  /* MODEL_COMMIT( state, action ) {
   *   const {schema} = action.payload;
   *   let db = schema.db( state );
   *   db.commit();
   *   return db.data;
   * },*/

  /* MODEL_POST_COMMIT_DIFF( state, action ) {
   *   const {response, schema} = action.payload;
   *   let db = schema.db( state );
   *   db.postCommitDiff( response );
   *   return db.data;
   * },*/

  /* MODEL_START_TRANSACTION( state, action ) {
   *   const schema = action.payload.schema;
   *   let db = new DB( state, {schema} );
   *   db.startTransaction( action.payload );
   *   return db.data;
   * },*/

  /* MODEL_SAVE_TRANSACTION( state, action ) {
   *   const schema = action.payload.schema;
   *   let db = new DB( state, {schema} );
   *   db.saveTransaction( action.payload.db );
   *   return db.data;
   * },

   * MODEL_COMMIT_TRANSACTION( state, action ) {
   *   const schema = action.payload.schema;
   *   let db = new DB( state, {schema} );
   *   db.commitTransaction( action.payload.name );
   *   return db.data;
   * },

   * MODEL_ABORT_TRANSACTION( state, action ) {
   *   const schema = action.payload.schema;
   *   let db = new DB( state, {schema} );
   *   db.abortTransaction( action.payload.name );
   *   return db.data;
   * }*/
});

/**
 * Manages the state of model views. If we have two views, BookView, and
 * AuthorView, then we would have a state like:
 *
 *  {
 *    BookView: {
 *      loading: true
 *    },
 *    AuthorView: {
 *      loading: false
 *    }
 *  }
 *
 */
const viewReducer = createReducer({}, {

  /**
   * Indicates a model view is currently loading.
   */
  MODEL_LOAD_VIEW_REQUEST( state, action ) {
    const { name } = action.payload
    const viewState = state[name] || {}
    console.debug( `Model: View load request: ${name}.` )
    return {
      ...state,
      [name]: {
        queries: {},
        ...viewState,
        loading: true
      }
    }
  },

  /**
   * Indicates a model view is currently loading.
   */
  MODEL_LOAD_VIEW_SUCCESS( state, action ) {
    const { name, results } = action.payload
    const viewState = state[name] || {}
    console.debug( `Model: View load success: ${name}: `, results )
    return {
      ...state,
      [name]: {
        ...viewState,
        queries: {
          ...viewState.queries,
          ...results
        },
        loading: false
      }
    };
  },

  MODEL_LOAD_VIEW_CLEAR( state, action ) {
    const {name} = action.payload;
    console.debug( `Model: View load clear: "${name}".` );
    return {
      ...state,
      [name]: {
        queries: {}
      }
    };
  },

  MODEL_PAGE_SUCCESS( state, action ) {
    const { viewName, queryName, results, meta } = action.payload
    const viewState = state[viewName] || {}
    console.debug( `Model: Next page success: ${viewName}: `, results );
    return {
      ...state,
      [viewName]: {
        ...viewState,
        [queryName]: results,
        meta: {
          ...(state[viewName].meta || {}),
          [queryName]: meta
        },
        loading: false
      }
    };
  },
});

const syncReducer = createReducer(
  false,
  {

    MODEL_SYNC_REQUEST( state, action ) {
      return true
    },

    MODEL_SYNC_SUCCESS( state, action ) {
      return false
    },

    MODEL_SYNC_FAILURE( state, action ) {
      return false
    }

  }
)

const modelReducer = combineReducers({
  db: dbReducer,
  views: viewReducer,
  sync: syncReducer
});

export default modelReducer;
