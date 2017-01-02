import { Map } from 'immutable';
import { combineReducers } from 'redux';

import DB from '../db';
import { createReducer } from './utils';
import { flattenObject } from '../utils';

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

  MODEL_ADD_BLOCKS( state, action ) {
    let db = new DB( state );
    const {blocks} = action;
    for( const block of blocks )
      db.addBlock( block );
    return db.data;
  },

  MODEL_SET_DB( state, action ) {
    return action.payload;
  },

  MODEL_APPLY_BLOCK( state, action ) {
    let db = new DB( state );
    db.applyBlock( action.payload );
    return db.data;
  },

  MODEL_SYNC_REQUEST( state, action ) {
    return state;
  },

  MODEL_COMMIT_DIFF( state, action ) {
    const { diff, response } = action.payload;
    let db = new DB( state );
    db.postCommitDiff( diff, response );
    db.popDiff();
    return {
      ...state,
      db: db.data
    };
  },

  MODEL_SYNC_SUCCESS( state, action ) {
    const { sync, syncErrors, ...rem } = state;
//    return rem;
    return state;
  },

  MODEL_SYNC_FAILURE( state, action ) {
    const { sync, ...rem } = state;
    return state;
    /* return {
       ...rem,
       syncErrors: action.payload
       }; */
  },

  MODEL_START_TRANSACTION( state, action ) {
    let db = new DB( state );
    db.startTransaction( action.name );
    return {...state, db: db.data};
  },

  MODEL_SAVE_TRANSACTION( state, action ) {
    let db = new DB( state );
    db.saveTransaction( action.transaction );
    return {...state, db: db.data};
  },

  MODEL_COMMIT_TRANSACTION( state, action ) {
    const schema = action.payload.schema;
    let db = new DB( state, {schema} );
    db.commitTransaction( action.payload );
    return db.data;
  },

  MODEL_ABORT_TRANSACTION( state, action ) {
    let db = new DB( state );
    db.abortTransaction( action.name );
    return {...state, db: db.data};
  }
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
    const { name } = action.payload;
    const viewState = state[name] || {};
    return {
      ...state,
      [name]: {
        ...viewState,
        loading: true
      }
    };
  },

  /**
   * Indicates a model view is currently loading.
   */
  MODEL_LOAD_VIEW_SUCCESS( state, action ) {
    const { name, results } = action.payload;
    const viewState = state[name] || {};
    console.debug( `Model: View load success: ${name}`, results );
    return {
      ...state,
      [name]: {
        ...viewState,
        ...results,
        loading: false
      }
    };
  }
});

const modelReducer = combineReducers({
  db: dbReducer,
  views: viewReducer
});

export default modelReducer;
